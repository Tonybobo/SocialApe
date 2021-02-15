const functions = require('firebase-functions');
const app = require('express')();

const { getAllPost, PostOnePost } = require('./handler/post');
const { signUp, login, uploadImage } = require('./handler/user');
const fbAuth = require('./util/fbAuth');

//Post Route
app.get('/posts', getAllPost);
app.post('/post', fbAuth, PostOnePost);

//User Route
app.post('/signup', signUp);
app.post('/login', login);
app.post('/user/image', fbAuth, uploadImage);

exports.api = functions.region('asia-southeast2').https.onRequest(app);
