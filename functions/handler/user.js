const { db, admin } = require('../util/admin');
const config = require('../util/config');
const firebase = require('firebase');
const { validataSignUpData, validateLoginData } = require('../util/validator');

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
						return res.status(500).json({ error: err.code });
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
			if (err.code === 'auth/wrong-password') {
				return res
					.status(403)
					.json({ general: 'Wrong Credentails, please try again' });
			} else {
				return res.status(500).json({ error: err.code });
			}
		});
};

exports.uploadImage = (req, res) => {
	const Busboy = require('busboy');
	const path = require('path');
	const os = require('os');
	const fs = require('fs');

	const busboy = new Busboy({ headers: req.headers });

	let imageFilename;
	let imageToBeUploaded = {};
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
						contentType: imageToBeUploaded.mimetype
					}
				}
			})
			.then(() => {
				const imageUrl = `https://firebasestorage.googleapis.com/v0/b/${config.storageBucket}/o/${imageFilename}?alt=media`;
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
