/**
 * @name SelfJS
 * @description Breaking discord's TOS to bot user accounts.
 * @author ImaEntity
 * @version 1.0.4
 */

const https = require("https");
const ws = require("ws");
const fs = require("fs");

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

	randomNonce: function() {
		const chars = "1234567890";
		let str = "";

		for(let i = 0; i < 16; i++) {
			str += chars[Math.floor(Math.random() * chars.length)];
		}

		return str;
	},

	sendWebhookMessage: function(webhookID, webhookToken, message) {
		let options = null;
		let msgData = null;

		if(message) {
			msgData = JSON.stringify({content: message});
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
			msgData = JSON.stringify({content: webhookToken});
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
		constructor(userID, sessionID, token) {
			this.endpoint = null;
			this.serverID = null;
			this.token = token;
			this.sessionID = sessionID;
			this.userID = userID;
			this.socket = null;
		}

		connect(endpoint, serverID, logMsgs) {
			return new Promise(function(resolve) {
				this.endpoint = endpoint;
				this.severID = serverID;
				this.socket = new ws(`wss://${endpoint}`);

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

						setInterval(function() {
							if(logMsgs) console.log("[RTCControlSocket] Sending heartbeat");
							this.socket.send(JSON.stringify({op: 3, d: Date.now()}));
						}.bind(this), payload.d.heartbeat_interval);
					} else if(payload.op == 6) {
						if(logMsgs) console.log("[RTCControlSocket] Heartbeat ACK received");
					} else if(payload.op == 2) {
						console.log(payload);
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
			this.voice = null;
		}

		login(token, isMobile, logMsgs) {
			return new Promise(function(resolve) {
				this.token = token;
			 	this.socket = new ws("wss://gateway.discord.gg?v=10&encoding=json");
				this.userID = null;
				this.sessionID = null;

				let sequenceID = null;

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

				this.socket.on("message", async function(payload) {
					payload = JSON.parse(payload.toString());

					if(payload.op == 10) {
						if(logMsgs) console.log("[MainControlSocket] Hello ACK received");

						if(logMsgs) console.log("[MainControlSocket] Sending heartbeat");
						this.socket.send(JSON.stringify({op: 1, d: sequenceID}));

						setInterval(function() {
							if(logMsgs) console.log("[MainControlSocket] Sending heartbeat");
							this.socket.send(JSON.stringify({op: 1, d: sequenceID}));
						}.bind(this), payload.d.heartbeat_interval	);
					} else if(payload.op == 11) {
						if(logMsgs) console.log("[MainControlSocket] Heartbeat ACK received");
					} else if(payload.op == 0) {
						sequenceID = payload.s;

						if(payload.t == "READY") {
							this.userID = payload.d.user.id;
							this.sessionID = payload.d.session_id;

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

							this.voice = new module.exports.VoiceConnection(this.userID, this.sessionID, token);
							await this.voice.connect(endpoint, serverID, logMsgs);
						}
					}
				}.bind(this));
			}.bind(this));
		}

		onMessage(msgFunc) {
			this.onMessageFunction = msgFunc;
		}

		onMessageEdit(editFunc) {
			this.onEditFunction = editFunc;
		}

		joinVoiceChannel(guildID, channelID) {
			this.socket.send(JSON.stringify({
				op: 4,
				d: {
					guild_id: guildID,
					channel_id: channelID,
					self_mute: false,
					self_deaf: false
				}
			}));
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

		removeFromChannel(channelID, userID, silent) {
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
