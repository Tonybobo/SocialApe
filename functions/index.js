const functions = require('firebase-functions');
const admin = require('firebase-admin');
const firebase = require('firebase');

admin.initializeApp();

const express = require('express');
const app = express();
const db = admin.firestore();
const firebaseConfig = {
	apiKey: 'AIzaSyASu2sUpfGoEFA-oNj4tuxrIQlUMaOttmI',
	authDomain: 'socialape-9a836.firebaseapp.com',
	projectId: 'socialape-9a836',
	storageBucket: 'socialape-9a836.appspot.com',
	messagingSenderId: '435867938949',
	appId: '1:435867938949:web:42ece83e0a50b0db2f79ec',
	measurementId: 'G-LQ2Z4TGW34'
};
firebase.initializeApp(firebaseConfig);

app.get('/posts', (req, res) => {
	db.collection('posts')
		.orderBy('createdAt', 'desc')
		.get()
		.then((data) => {
			let posts = [];
			data.forEach((doc) => {
				posts.push({
					postId: doc.id,
					...doc.data()
				});
			});
			return res.json(posts);
		})
		.catch((err) => console.error(err));
});
app.post('/post', (req, res) => {
	const newPost = {
		body: req.body.body,
		username: req.body.username,
		createdAt: new Date().toISOString()
	};
	db.collection('posts')
		.add(newPost)
		.then((doc) => {
			res.json({ message: `document ${doc.id} created successfully` });
		})
		.catch((err) => {
			res.status(500).json({
				error: 'something went wrong'
			});
			console.error(err);
		});
});

const isEmail = (email) => {
	const regEx = /^(([^<>()\[\]\\.,;:\s@"]+(\.[^<>()\[\]\\.,;:\s@"]+)*)|(".+"))@((\[[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\])|(([a-zA-Z\-0-9]+\.)+[a-zA-Z]{2,}))$/;
	if (email.match(regEx)) return true;
	else return false;
};

const isEmpty = (string) => {
	if (string.trim() === '') return true;
	else return false;
};

//SignUp route

app.post('/signup', (req, res) => {
	const newUser = {
		email: req.body.email,
		password: req.body.password,
		confirmPassword: req.body.confirmPassword,
		username: req.body.username
	};

	let errors = {};

	if (isEmpty(newUser.email)) {
		errors.email = 'Email must not be empty';
	} else if (!isEmail(newUser.email)) {
		errors.email = 'Must be a valid email address';
	}
	if (isEmpty(newUser.password)) errors.password = 'Must not be empty';
	if (newUser.password !== newUser.confirmPassword)
		errors.confirmPassword = 'Password must match';
	if (isEmpty(newUser.username)) errors.username = 'Must not be empty';

	if (Object.keys(errors).length > 0) return res.status(400).json(errors);

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
							userId
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
});

//Login route

app.post('/login', (req, res) => {
	const user = {
		email: req.body.email,
		password: req.body.password
	};

	let errors = {};
	if (isEmpty(user.email)) errors.email = 'Email Must not be Empty';
	if (isEmpty(user.password)) errors.password = 'Password Must not be Empty';

	if (Object.keys(errors).length > 0) return res.status(400).json(errors);

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
});

exports.api = functions.region('asia-southeast2').https.onRequest(app);
