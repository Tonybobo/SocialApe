const { db, admin } = require('../util/admin');
const config = require('../util/config');
const firebase = require('firebase');
const {
	validataSignUpData,
	validateLoginData,
	reduceUserDetail
} = require('../util/validator');

const { uuid } = require('uuidv4');
firebase.initializeApp(config);

exports.signUp = (req, res) => {
	const newUser = {
		email: req.body.email,
		password: req.body.password,
		confirmPassword: req.body.confirmPassword,
		username: req.body.username
	};

	const { valid, errors } = validataSignUpData(newUser);

	if (!valid) return res.status(400).json(errors);

	const avatarImage = 'avatar.png';

	let token, userId;
	db.doc(`/user/${newUser.username}`)
		.get()
		.then((doc) => {
			if (doc.exists) {
				return res
					.status(400)
					.json({ handle: 'this username is already taken' });
			} else {
				return firebase
					.auth()
					.createUserWithEmailAndPassword(newUser.email, newUser.password)
					.then((data) => {
						userId = data.user.uid;
						return data.user.getIdToken();
					})
					.then((idtoken) => {
						token = idtoken;
						const userCondentials = {
							...newUser,
							userId,
							imageUrl: `https://firebasestorage.googleapis.com/v0/b/${config.storageBucket}/o/${avatarImage}?alt=media`
						};
						return db.doc(`/user/${newUser.username}`).set(userCondentials);
					})
					.then(() => {
						return res.status(201).json({ token });
					})
					.catch((err) => {
						console.error(err);
						if (err.code === 'auth/email-already-in-use') {
							res.status(400).json({
								email: 'Email is already in use'
							});
						}
						return res
							.status(500)
							.json({ general: 'Something went Wrong. Please try again!' });
					});
			}
		});
};

exports.login = (req, res) => {
	const user = {
		email: req.body.email,
		password: req.body.password
	};
	const { valid, errors } = validateLoginData(user);

	if (!valid) return res.status(400).json(errors);

	firebase
		.auth()
		.signInWithEmailAndPassword(user.email, user.password)
		.then((data) => {
			return data.user.getIdToken();
		})
		.then((token) => {
			return res.json({ token });
		})
		.catch((err) => {
			console.log(err);
			return res
				.status(403)
				.json({ general: 'Wrong credentials, please try again' });
		});
};
//Add user detail

exports.addUserDetail = (req, res) => {
	let userDetails = reduceUserDetail(req.body);

	db.doc(`/user/${req.user.username}`)
		.update(userDetails)
		.then(() => {
			return res.json({ message: 'details added successfully' });
		})
		.catch((err) => {
			console.error(err);
			return res.status(500).json({ error: err.code });
		});
};
//get any user's details
exports.getUserDetails = (req, res) => {
	let userData = {};
	db.doc(`/user/${req.params.username}`)
		.get()
		.then((doc) => {
			if (doc.exists) {
				userData.user = doc.data();
				return db
					.collection('posts')
					.where('username', '==', req.params.username)
					.orderBy('createdAt', 'desc')
					.get();
			}
		})
		.then((data) => {
			userData.posts = {};
			data.forEach((doc) => {
				userData.post.push({
					...doc.data(),
					postId: doc.id
				});
			});
			return res.json(userData);
		})
		.catch((err) => {
			console.error(err);
			return res.status(500).json({ error: err.code });
		});
};

//get all user details
exports.getAuthenticatedUser = (req, res) => {
	let userData = {};
	db.doc(`/user/${req.user.username}`)
		.get()
		.then((doc) => {
			if (doc.exists) {
				userData.credentials = doc.data();
				return db
					.collection('likes')
					.where('username', '==', req.user.username)
					.get();
			} else {
				return res.status(404).json({ error: 'user not found' });
			}
		})
		.then((data) => {
			userData.likes = [];
			data.forEach((doc) => {
				userData.likes.push(doc.data());
			});
			return db
				.collection('notifications')
				.where('recipient', '==', req.user.username)
				.orderBy('createdAt', 'desc')
				.limit(10)
				.get();
		})
		.then((data) => {
			userData.notifications = [];
			data.forEach((doc) => {
				userData.notifications.push({
					...doc.data(),
					notificationId: doc.id
				});
			});
			return res.json(userData);
		})
		.catch((err) => {
			console.error(err);
			res.status(500).json({ error: err.code });
		});
};

//Upload Profile Picture
exports.uploadImage = (req, res) => {
	const Busboy = require('busboy');
	const path = require('path');
	const os = require('os');
	const fs = require('fs');

	const busboy = new Busboy({ headers: req.headers });

	let imageFilename;
	let imageToBeUploaded = {};
	let generatedToken = uuid();
	busboy.on('file', (fieldname, file, filename, encoding, mimetype) => {
		if (mimetype !== 'image/jpeg' && mimetype !== 'image/png') {
			return res.status(400).json({ error: 'Wrong file type submitted' });
		}
		const imageExtension = filename.split('.')[filename.split('.').length - 1];
		imageFilename = `${Math.round(
			Math.random() * 100000000000
		)}.${imageExtension}`;
		const filepath = path.join(os.tmpdir(), imageFilename);
		imageToBeUploaded = { filepath, mimetype };
		file.pipe(fs.createWriteStream(filepath));
	});
	busboy.on('finish', () => {
		admin
			.storage()
			.bucket()
			.upload(imageToBeUploaded.filepath, {
				resumable: false,
				metadata: {
					metadata: {
						contentType: imageToBeUploaded.mimetype,
						firebaseStorageDownloadTokens: generatedToken
					}
				}
			})
			.then(() => {
				const imageUrl = `https://firebasestorage.googleapis.com/v0/b/${config.storageBucket}/o/${imageFilename}?alt=media&token=${generatedToken}`;
				return db
					.doc(`/user/${req.user.username}`)
					.update({ imageUrl })
					.then(() => {
						return res.json({ message: 'image Uploaded successfully' });
					})
					.catch((err) => {
						console.error(error);
						return res.status(500).json({ error: err.code });
					});
			});
	});
	busboy.end(req.rawBody);
};

exports.markNotificationRead = (req, res) => {
	console.log(req.body);
	let batch = db.batch();
	req.body.forEach((notificationId) => {
		const notification = db.doc(`/notifications/${notificationId}`);
		batch.update(notification, { read: true });
	});
	batch
		.commit()
		.then(() => {
			return res.json({ message: 'Notifications marked read' });
		})
		.catch((err) => {
			console.error(err);
			return res.status(500).json({ error: err.code });
		});
};
