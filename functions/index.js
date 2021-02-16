const functions = require('firebase-functions');
const app = require('express')();

const {
	getAllPost,
	PostOnePost,
	getPost,
	commentOnPost,
	likePost,
	unlikePost,
	deletePost
} = require('./handler/post');
const {
	signUp,
	login,
	uploadImage,
	addUserDetail,
	getAuthenticatedUser
} = require('./handler/user');
const fbAuth = require('./util/fbAuth');

//Post Route
app.get('/posts', getAllPost);
app.post('/post', fbAuth, PostOnePost);
app.get('/post/:postId', getPost);
//TODO: delete post
app.delete('/post/:postId', fbAuth, deletePost);
//TODO: like post
app.get('/post/:postId/like', fbAuth, likePost);
//TODO:Unlike post
app.get('/post/:postId/unlike', fbAuth, unlikePost);
//TODO: comment on post
app.post('/post/:postId/comment', fbAuth, commentOnPost);
//TODO: delete comment on post

//User Route
app.post('/signup', signUp);
app.post('/login', login);
app.post('/user/image', fbAuth, uploadImage);
app.post('/user', fbAuth, addUserDetail);
app.get('/user', fbAuth, getAuthenticatedUser);

exports.api = functions.region('asia-southeast2').https.onRequest(app);
