/**
 * @name SelfJS
 * @description Breaking discord's TOS to bot user accounts.
 * @author ImaEntity
 * @version 1.0.7
 */

const https = require("https");
const ws = require("ws");
const fs = require("fs");
const crypto = require("crypto");
const dgram = require("dgram");

module.exports = {
	CDNBaseOpt: {
		host: "cdn.discordapp.com",
		port: 443
	},

	APIBaseOpt: {
		host: "discord.com",
		port: 443
	},

	status: {
		DEFAULT: -1,
		PLAYING: 0,
		LISTENING: 2,
		WATCHING: 3,
		COMPETING: 5
	},

	sleep: function(millis) {
		return new Promise(function(res) {
			setTimeout(res, millis);
		});
	},

	randomNonce: function(len) {
		const chars = "1234567890";
		let str = "";

		for(let i = 0; i < len; i++) {
			str += chars[Math.floor(Math.random() * chars.length)];
		}

		return str;
	},

	sendWebhookMessage: function(webhookID, webhookToken, inputData) {
		let options = null;
		let msgData = null;

		if(inputData) {
			msgData = JSON.stringify(inputData);
			options = {
				...module.exports.APIBaseOpt,
				method: "POST",
				path: `/api/webhooks/${webhookID}/${webhookToken}`,
				headers: {
					"Content-Type": "application/json",
					"Content-Length": msgData.length
				}
			};
		} else {
			msgData = JSON.stringify(webhookToken);
			options = {
				...module.exports.APIBaseOpt,
				method: "POST",
				path: webhookID.split("//")[1].split('/').slice(1).join('/'),
				headers: {
					"Content-Type": "application/json",
					"Content-Length": msgData.length
				}
			};
		}

		return new Promise(function(resolve) {
			const req = https.request(options, function(res) {
				res.on("end", resolve);
			});

			req.write(msgData);
			req.end();
		});
	},

	VoiceConnection: class {
		constructor() {
			this.endpoint = null;
			this.serverID = null;
			this.channelID = null;
			this.token = null;
			this.sessionID = null;
			this.userID = null;
			this.socket = null;
			this.ip = null;
			this.ssrc = null;
			this.port = null;
			this.key = null;
			this.mediaSessionID = null;
		}

		connect(logMsgs) {
			return new Promise(function(resolve) {
				this.socket = new ws(`wss://${this.endpoint}?v=4&encoding=json`);

				this.socket.on("open", function() {
					if(logMsgs) console.log("[RTCControlSocket] Sending hello");

					this.socket.send(JSON.stringify({
						op: 0,
						d: {
							server_id: this.serverID,
							user_id: this.userID,
							session_id: this.sessionID,
							token: this.token
						}
					}));
				}.bind(this));

				this.socket.on("message", function(payload) {
					payload = JSON.parse(payload.toString());

					if(payload.op == 8) {
						if(logMsgs) console.log("[RTCControlSocket] Hello ACK received");

						if(logMsgs) console.log("[RTCControlSocket] Sending heartbeat");
						this.socket.send(JSON.stringify({op: 3, d: Date.now()}));

						setInterval(function() {
							if(logMsgs) console.log("[RTCControlSocket] Sending heartbeat");
							this.socket.send(JSON.stringify({op: 3, d: Date.now()}));
						}.bind(this), payload.d.heartbeat_interval);
					} else if(payload.op == 6) {
						if(logMsgs) console.log("[RTCControlSocket] Heartbeat ACK received");
					} else if(payload.op == 2) {
						this.ssrc = payload.d.ssrc;
						this.port = payload.d.port;
						this.ip = payload.d.ip;

						this.socket.send(JSON.stringify({
							op: 1,
							d: {
								protocol: "udp",
								data: {
									address: "127.0.0.1",
									port: this.port,
									mode: "xsalsa20_poly1305_suffix"
								}
							}
						}));
					} else if(payload.op == 4) {
						this.key = payload.d.secret_key;
					}
				}.bind(this));
			}.bind(this));
		}
	},

	Client: class {
		constructor() {
			this.userID = null;
			this.token = null;
			this.socket = null;
			this.sessionID = null;
			this.onMessageFunction = null;
			this.onEditFunction = null;
			this.voice = new module.exports.VoiceConnection();
			this.sequenceID = null;
			this.resumeURL = null;
		}

		login(token, isMobile, logMsgs) {
			return new Promise(function(resolve) {
				this.token = token;
			 	this.socket = new ws("wss://gateway.discord.gg?v=10&encoding=json");
				this.userID = null;
				this.sessionID = null;

				this.socket.on("open", function() {
					if(logMsgs) console.log("[MainControlSocket] Sending hello");

					this.socket.send(JSON.stringify({
						op: 2,
						d: {
							token: this.token,
							properties: {
								$os: isMobile ? "linux" : "windows",
								$browser: isMobile ? "Discord iOS" : "disco",
								$device: isMobile ? "discord.gblk" : "disco"
							}
						}
					}));
				}.bind(this));

				const socketMessageFunction = async function(payload) {
					payload = JSON.parse(payload.toString());

					if(payload.op == 10) {
						if(logMsgs) console.log("[MainControlSocket] Hello ACK received");

						if(logMsgs) console.log("[MainControlSocket] Sending heartbeat");
						this.socket.send(JSON.stringify({op: 1, d: this.sequenceID}));

						setInterval(function() {
							if(logMsgs) console.log("[MainControlSocket] Sending heartbeat");
							this.socket.send(JSON.stringify({op: 1, d: this.sequenceID}));
						}.bind(this), payload.d.heartbeat_interval);
					} else if(payload.op == 11) {
						if(logMsgs) console.log("[MainControlSocket] Heartbeat ACK received");
					} else if(payload.op == 0) {
						this.sequenceID = payload.s;

						if(payload.t == "READY") {
							this.userID = payload.d.user.id;
							this.sessionID = payload.d.session_id;
							this.resumeURL = payload.d.resume_gateway_url;

							if(logMsgs) console.log("[MainControlSocket] Ready message received");
							resolve();
						} else if(payload.t == "MESSAGE_CREATE") {
							const ackData = JSON.stringify({token: null});
							const options = {
								...module.exports.APIBaseOpt,
								method: "POST",
								path: `/api/v10/channels/${payload.d.channel_id}/messages/${payload.d.id}/ack`,
								headers: {
									"Authorization": this.token,
									"Content-Type": "application/json",
									"Content-Length": ackData.length
								}
							};

							const req = https.request(options);

							req.write(ackData);
							req.end();

							try {payload.d.author.self = payload.d.author.id == this.userID;} catch(e) {}

							if(typeof this.onMessageFunction == "function") this.onMessageFunction(payload.d);
						} else if(payload.t == "MESSAGE_UPDATE") {
							try {payload.d.author.self = payload.d.author.id == this.userID;} catch(e) {}

							if(typeof this.onEditFunction == "function") this.onEditFunction(payload.d);
						} else if(payload.t == "VOICE_SERVER_UPDATE") {
							const endpoint = payload.d.endpoint;
							const serverID = payload.d.guild_id;
							const token = payload.d.token;

							this.voice.userID = this.userID;
							this.voice.endpoint = endpoint;
							this.voice.serverID = serverID ?? this.voice.channelID;
							this.voice.token = token;

							if(this.voice.sessionID != null) {
								await this.voice.connect(logMsgs);
							}
						} else if(payload.t == "VOICE_STATE_UPDATE") {
							this.voice.sessionID = payload.d.session_id;

							if(this.voice.userID != null) {
								await this.voice.connect(logMsgs);
							}
						}
					} else if(payload.op == 7) {
						if(logMsgs) console.log("[MainControlSocket] Reconnect message received");

						this.socket = new ws("wss://gateway.discord.gg?v=10&encoding=json");

						this.socket.on("open", function() {
							if(logMsgs) console.log("[MainControlSocket] Resume message sent");

							this.socket.send(JSON.stringify({
								op: 6,
								d: {
									token: this.token,
									session_id: this.sessionID,
									seq: this.sequenceID
								}
							}));
						}.bind(this));

						this.socket.on("message", socketMessageFunction);
					}
				}.bind(this);

				this.socket.on("message", socketMessageFunction);
			}.bind(this));
		}

		onMessage(msgFunc) {
			this.onMessageFunction = msgFunc;
		}

		onMessageEdit(editFunc) {
			this.onEditFunction = editFunc;
		}

		joinVoiceChannel(guildID, channelID, mute, deaf) {
			this.voice.channelID = channelID;

			this.socket.send(JSON.stringify({
				op: 4,
				d: {
					guild_id: guildID,
					channel_id: channelID,
					self_mute: mute ?? false,
					self_deaf: deaf ?? false
				}
			}));
		}

		waitForVoice() {
			return new Promise(function(resolve) {
				const loop = setInterval(function() {
					if(!this.voice.key) return;

					clearInterval(loop);
					resolve();
				}.bind(this));
			}.bind(this));
		}

		playSound(filename) {
			const time = Date.now();
			const audioData = fs.readFileSync(filename);
			const iv = crypto.randomBytes(16);
			const cipher = crypto.createCipheriv("aes-256-cbc", Buffer.from(this.voice.key), iv);

			let encryptedData = cipher.update(audioData) + cipher.final();
			let packetBuf = Buffer.from([
				0x80,
				0x78,
				(this.sequenceID & 0xFF00) >> 8,
				this.sequenceID & 0xFF,
				(time & 0xFF000000) >> 24,
				(time & 0xFF0000) >> 16,
				(time & 0xFF00) >> 8,
				time & 0xFF,
				(this.voice.ssrc & 0xFF000000) >> 24,
				(this.voice.ssrc & 0xFF0000) >> 16,
				(this.voice.ssrc & 0xFF00) >> 8,
				this.voice.ssrc & 0xFF,
			]);

			encryptedData = Buffer.concat([iv, Buffer.from(encryptedData)]);
			packetBuf = Buffer.concat([packetBuf, encryptedData]);

			this.voice.socket.send(JSON.stringify({
				op: 5,
				d: {
					speaking: 1,
					delay: 0,
					ssrc: this.voice.ssrc
				}
			}));

			const client = dgram.createSocket("udp4");

			client.send(packetBuf, 0, packetBuf.length, this.voice.port, this.voice.ip, function() {
				this.voice.socket.send(JSON.stringify({
					op: 5,
					d: {
						speaking: 0,
						delay: 0,
						ssrc: this.voice.ssrc
					}
				}));
			}.bind(this));
		}

		getDMChannel(userID) {
			const channelData = JSON.stringify({recipients: [userID]});
			const options = {
				...module.exports.APIBaseOpt,
				method: "POST",
				path: "/api/v10/users/@me/channels",
				headers: {
					"Authorization": this.token,
					"Content-Type": "application/json",
					"Content-Length": channelData.length
				}
			};

			return new Promise(function(resolve) {
				const req = https.request(options, function(res) {
					const chunks = [];

					res.on("data", function(chunk) {
						chunks.push(chunk);
					}).on("end", function() {
						resolve(JSON.parse(Buffer.concat(chunks)));
					});
				});

				req.write(channelData);
				req.end();
			});
		}

		getRoles(severID, userID) {
			const options = {
				...module.exports.APIBaseOpt,
				method: "GET",
				path: `/api/v10/users/${userID}/profile?with_mutual_guilds=false&guild_id=${serverID}`,
				headers: {
					"Authorization": this.token
				}
			};

			return new Promise(function(resolve) {
				const req = https.request(options, function(res) {
					const chunks = [];

					res.on("data", function(chunk) {
						chunks.push(chunk);
					}).on("end", function() {
						resolve(JSON.parse(Buffer.concat(chunks)).guild_member.roles);
					});
				});

				req.end();
			});
		}

		sendImage(channelID, imageName) {
			const imgData = fs.readFileSync(imageName).toString();
			const imgName = imageName.split('/').pop();
			console.log(imgName);
			const reqData = JSON.stringify({
				files: [{
					filename: imgName,
					file_size: imgData.length,
					id: 0
				}]
			});
			const reqOpt = {
				...module.exports.APIBaseOpt,
				method: "POST",
				path: `/api/v10/channels/${channelID}/attachments`,
				headers: {
					"Authorization": this.token,
					"Content-Type": "application/json",
					"Content-Length": reqData.length
				}
			};

			return new Promise(function(resolve) {
				const reqReq = https.request(reqOpt, function(reqRes) {
					const reqChunks = [];

					reqRes.on("data", function(chunk) {
						reqChunks.push(chunk);
					}).on("end", function() {
						const data = JSON.parse(Buffer.concat(reqChunks));
						console.log(data);
						fs.writeFileSync("out.json", JSON.stringify(data, null, 4));
						const uploadedFilename = data.attachments[0].upload_filename;
						const imgOpt = {
							port: 443,
							host: data.attachments[0].upload_url.split('/')[2],
							path: `/${data.attachments[0].upload_url.split('/').slice(3).join('/')}`,
							headers: {
								"Content-Type": "image/png",
								"Content-Length": imgData.length
							}
						};

						const imgReq = https.request(imgOpt, function(imgRes) {
							imgRes.on("end", function() {
								const msgData = JSON.stringify({
									content: "",
									attachments: [{
										filename: imgName,
										id: "0",
										uploaded_filename: uploadedFilename
									}]
								});
								const msgOpt = {
									...module.exports.APIBaseOpt,
									method: "POST",
									path: `/api/v10/channels/${channelID}`,
									headers: {
										"Content-Type": "application/json",
										"Content-Length": msgData.length,
										"Authorization": this.token
									}
								};

								const msgReq = https.request(msgOpt, function(msgRes) {
									const msgChunks = [];

									msgRes.on("data", function(chunk) {
										msgChunks.push(chunk);
									}).on("end", function() {
										resolve(JSON.parse(Buffer.concat(msgChunks)));
									});
								});

								msgReq.write(msgData);
								msgReq.end();
							});
						});

						reqReq.write(imgData);
						reqReq.end();
					});
				});

				reqReq.write(reqData);
				reqReq.end();
			});
		}

		getUserData(userID) {
			const options = {
				...module.exports.APIBaseOpt,
				method: "GET",
				path: `/api/v10/users/${userID}/profile?with_mutual_guilds=false`,
				headers: {
					"Authorization": this.token
				}
			};

			return new Promise(function(resolve) {
				const req = https.request(options, function(res) {
					const chunks = [];

					res.on("data", function(chunk) {
						chunks.push(chunk);
					}).on("end", function() {
						resolve(JSON.parse(Buffer.concat(chunks)));
					});
				});

				req.end();
			});
		}

		setRolesForMemeber(serverID, userID, roleIDs) {
			const roleData = JSON.stringify(roleIDs);
			const options = {
				...module.exports.APIBaseOpt,
				method: "PATCH",
				path: `/api/v10/guilds/${serverID}/members/${userID}`,
				headers: {
					"Content-Type": "application/json",
					"Content-Length": roleData.length,
					"Authorization": this.token
				}
			};

			return new Promise(function(resolve) {
				const req = https.request(options, function(res) {
					res.on("end", resolve);
				});

				req.write(roleData);
				req.end();
			});
		}

		sendMessage(channelID, message) {
			const msgData = JSON.stringify({content: message});
			const options = {
				...module.exports.APIBaseOpt,
				method: "POST",
				path: `/api/v10/channels/${channelID}/messages`,
				headers: {
					"Authorization": this.token,
					"Content-Type": "application/json",
					"Content-Length": msgData.length
				}
			};

			return new Promise(function(resolve) {
				const req = https.request(options, function(res) {
					const chunks = [];

					res.on("data", function(chunk) {
						chunks.push(chunk);
					}).on("end", function() {
						resolve(JSON.parse(Buffer.concat(chunks)));
					});
				});

				req.write(msgData);
				req.end();
			});
		}

		replyToMessage(channelID, messageID, message) {
			const msgData = JSON.stringify({content: message, message_reference: {channel_id: channelID, message_id: messageID}});
			const options = {
				...module.exports.APIBaseOpt,
				method: "POST",
				path: `/api/v10/channels/${channelID}/messages`,
				headers: {
					"Authorization": this.token,
					"Content-Type": "application/json",
					"Content-Length": msgData.length
				}
			};

			return new Promise(function(resolve) {
				const req = https.request(options, function(res) {
					const chunks = [];

					res.on("data", function(chunk) {
						chunks.push(chunk);
					}).on("end", function() {
						resolve(JSON.parse(Buffer.concat(chunks)));
					});
				});

				req.write(msgData);
				req.end();
			});
		}

		getMessages(channelID, limit) {
			const options = {
				...module.exports.APIBaseOpt,
				method: "GET",
				path: `/api/v10/channels/${channelID}/messages?limit=${limit}`,
				headers: {
					"Authorization": this.token
				}
			};

			return new Promise(function(resolve) {
				const req = https.request(options, function(res) {
					const chunks = [];

					res.on("data", function(chunk) {
						chunks.push(chunk);
					}).on("end", function() {
						resolve(JSON.parse(Buffer.concat(chunks)));
					});
				});

				req.end();
			});
		}

		getUsers(guildID) {
			const options = {
				...module.exports.APIBaseOpt,
				method: "GET",
				path: `/api/v10/guilds/${guildID}/members`,
				headers: {
					"Authorization": this.token
				}
			};

			return new Promise(function(resolve) {
				const req = https.request(options, function(res) {
					const chunks = [];

					res.on("data", function(chunk) {
						chunks.push(chunk);
					}).on("end", function() {
						resolve(JSON.parse(Buffer.concat(chunks)));
					});
				});

				req.end();
			});
		}

		removeFromChannel(channelID, userID) {
			const options = {
				...module.exports.APIBaseOpt,
				method: "DELETE",
				path: `/api/v10/channels/${channelID}/recipients/${userID}`,
				headers: {
					"Authorization": this.token
				}
			};

			return new Promise(function(resolve) {
				const req = https.request(options, function(res) {
					res.on("end", resolve);
				});

				req.end();
			});
		}

		leaveChannel(channelID) {
			return new Promise(function(resolve) {
				this.removeFromChannel(channelID, this.userID).then(resolve);
			}.bind(this));
		}

		ring(channelID, userIDs) {
			const ringData = JSON.stringify({recipients: userIDs});
			const options = {
				...module.exports.APIBaseOpt,
				method: "POST",
				path: `/api/v10/channels/${channelID}/call/ring`,
				headers: {
					"Authorization": this.token,
					"Content-Type": "application/json",
					"Content-Length": ringData.length
				}
			};

			return new Promise(function(resolve) {
				const req = https.request(options, function(res) {
					res.on("end", resolve);
				});

				req.write(ringData);
				req.end();
			});
		}

		stopRinging(channelID, userIDs) {
			const ringData = JSON.stringify({recipients: userIDs});
			const options = {
				...module.exports.APIBaseOpt,
				method: "POST",
				path: `/api/v10/channels/${channelID}/call/stop-ringing`,
				headers: {
					"Authorization": this.token,
					"Content-Type": "application/json",
					"Content-Length": ringData.length
				}
			};

			return new Promise(function(resolve) {
				const req = https.request(options, function(res) {
					res.on("end", resolve);
				});

				req.write(ringData);
				req.end();
			});
		}

		addToChannel(channelID, userID) {
			const options = {
				...module.exports.APIBaseOpt,
				method: "PUT",
				path: `/api/v10/channels/${channelID}/recipients/${userID}`,
				headers: {
					"Authorization": this.token,
					"Content-Length": 0
				}
			};

			return new Promise(function(resolve) {
				const req = https.request(options, function(res) {
					res.on("end", resolve);
				});

				req.write("");
				req.end();
			});
		}

		getAvatar(userID, avatarID) {
			const options = {
				...module.exports.CDNBaseOpt,
				method: "GET",
				path: `/avatars/${userID}/${avatarID}.webp?size=512`
			};

			return new Promise(function(resolve) {
				const req = https.request(options, function(res) {
					const chunks = [];

					res.on("data", function(chunk) {
						chunks.push(chunk);
					}).on("end", function() {
						resolve(Buffer.concat(chunks));
					});
				});

				req.end();
			});
		}

		addFriend(userID) {
			const options = {
				...module.exports.APIBaseOpt,
				method: "PUT",
				path: `/api/v10/users/@me/relationships/${userID}`,
				headers: {
					"Authorization": this.token,
					"Content-Length": 0
				}
			};

			return new Promise(function(resolve) {
				const req = https.request(options, function(res) {
					res.on("end", resolve);
				});

				req.write("");
				req.end();
			});
		}

		editMessage(channelID, messageID, newMessage) {
			const msgData = JSON.stringify({content: newMessage});
			const options = {
				...module.exports.APIBaseOpt,
				method: "PATCH",
				path: `/api/v10/channels/${channelID}/messages/${messageID}`,
				headers: {
					"Authorization": this.token,
					"Content-Type": "application/json",
					"Content-Length": msgData.length
				}
			};

			return new Promise(function(resolve) {
				const req = https.request(options, function(res) {
					res.on("end", resolve);
				});

				req.write(msgData);
				req.end();
			});
		}

		removeFriend(userID) {
			const options = {
				...module.exports.APIBaseOpt,
				method: "DELETE",
				path: `/api/v10/users/@me/relationships/${userID}`,
				headers: {
					"Authorization": this.token
				}
			};

			return new Promise(function(resolve) {
				const req = https.request(options, function(res) {
					res.on("end", resolve);
				});

				req.end();
			});
		}

		renameChannel(channelID, channelName) {
			const nameData = JSON.stringify({name: channelName});
			const options = {
				...module.exports.APIBaseOpt,
				method: "PATCH",
				path: `/api/v10/channels/${channelID}`,
				headers: {
					"Authorization": this.token,
					"Content-Type": "application/json",
					"Content-Length": nameData.length
				}
			};

			return new Promise(function(resolve) {
				const req = https.request(options, function(res) {
					res.on("end", resolve);
				});

				req.write(nameData);
				req.end();
			});
		}

		block(userID) {
			const blockData = JSON.stringify({type: 2});
			const options = {
				...module.exports.APIBaseOpt,
				method: "PUT",
				path: `/api/v10/users/@me/relationships/${userID}`,
				headers: {
					"Authorization": this.token,
					"Content-Type": "application/json",
					"Content-Length": blockData.length
				}
			};

			return new Promise(function(resolve) {
				const req = https.request(options, function(res) {
					res.on("end", resolve);
				});

				req.write(blockData);
				req.end();
			});
		}

		unblock(userID) {
			return new Promise(function(resolve) {
				this.removeFriend(userID).then(resolve);
			}.bind(this));
		}

		deleteMessage(channelID, messageID) {
			const options = {
				...module.exports.APIBaseOpt,
				method: "DELETE",
				path: `/api/v10/channels/${channelID}/messages/${messageID}`,
				headers: {
					"Authorization": this.token
				}
			};

			return new Promise(function(resolve) {
				const req = https.request(options, function(res) {
					res.on("end", resolve);
				});

				req.end();
			});
		}

		setStatus(status, activity, type) {
			return new Promise(function(resolve) {
				this.socket.send(JSON.stringify({
					op: 3,
					d: {
						since: Date.now(),
						status,
						activities: [{
							name: activity,
							type
						}],
						afk: false
					}
				}));

				setTimeout(resolve, 1000);
			}.bind(this));
		}

		createChannel(userIDs) {
			const userData = JSON.stringify({recipients: userIDs});
			const options = {
				...module.exports.APIBaseOpt,
				method: "POST",
				path: `/api/v10/users/@me/channels`,
				headers: {
					"Authorization": this.token,
					"Content-Type": "application/json",
					"Content-Length": userData.length
				}
			};

			return new Promise(function(resolve) {
				const req = https.request(options, function(res) {
					const chunks = [];

					res.on("data", function(chunk) {
						chunks.push(chunk);
					}).on("end", function() {
						resolve(JSON.parse(Buffer.concat(chunks)));
					});
				});

				req.write(userData);
				req.end();
			});
		}

		startTyping(channelID) {
			const options = {
				...module.exports.APIBaseOpt,
				method: "POST",
				path: `/api/v10/channels/${channelID}/typing`,
				headers: {
					"Authorization": this.token,
					"Content-Length": 0
				}
			};

			return new Promise(function(resolve) {
				const req = https.request(options, function(res) {
					res.on("end", resolve);
				});

				req.write("");
				req.end();
			});
		}

		pinMessage(channelID, messageID) {
			const options = {
				...module.exports.APIBaseOpt,
				method: "PUT",
				path: `/api/v10/channels/${channelID}/pins/${messageID}`,
				headers: {
					"Authorization": this.token,
					"Content-Length": 0
				}
			};

			return new Promise(function(resolve) {
				const req = https.request(options, function(res) {
					res.on("end", resolve);
				});

				req.write("");
				req.end();
			});
		}

		unpinMessage(channelID, messageID) {
			const options = {
				...module.exports.APIBaseOpt,
				method: "DELETE",
				path: `/api/v10/channels/${channelID}/pins/${messageID}`,
				headers: {
					"Authorization": this.token
				}
			};

			return new Promise(function(resolve) {
				const req = https.request(options, function(res) {
					res.on("end", resolve);
				});

				req.end();
			});
		}

		editNote(userID, note) {
			const noteData = JSON.stringify({note});
			const options = {
				...module.exports.APIBaseOpt,
				method: "PUT",
				path: `/api/v10/users/@me/notes/${userID}`,
				headers: {
					"Authorization": this.token,
					"Content-Type": "application/json",
					"Content-Length": noteData.length
				}
			};

			return new Promise(function(resolve) {
				const req = https.request(options, function(res) {
					res.on("end", resolve);
				});

				req.write(noteData);
				req.end();
			});
		}

		getChannelData(channelID) {
			const options = {
				...module.exports.APIBaseOpt,
				method: "GET",
				path: `/api/v10/channels/${channelID}`,
				headers: {
					"Authorization": this.token
				}
			};

			return new Promise(function(resolve) {
				const req = https.request(options, function(res) {
					let chunks = [];

					res.on("data", function(chunk) {
						chunks.push(chunk);
					}).on("end", function() {
						resolve(JSON.parse(Buffer.concat(chunks)));
					});
				});

				req.end();
			});
		}

		transferOwnership(channelID, userID) {
			const ownershipData = JSON.stringify({owner: userID});
			const options = {
				...module.exports.APIBaseOpt,
				method: "PATCH",
				path: `/api/v10/channels/${channelID}`,
				headers: {
					"Authorization": this.token,
					"Content-Type": "application/json",
					"Content-Length": ownershipData.length
				}
			};

			return new Promise(function(resolve) {
				const req = https.request(options, function(res) {
					res.on("end", resolve);
				});

				req.write(ownershipData);
				req.end();
			});
		}
	}
};
