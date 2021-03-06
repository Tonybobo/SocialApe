const functions = require('firebase-functions');
const app = require('express')();
const { db } = require('./util/admin');
const cors = require('cors');
app.use(cors());
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
	getAuthenticatedUser,
	getUserDetails,
	markNotificationRead
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
app.get('/user/:username', getUserDetails);
app.post('/notifications', fbAuth, markNotificationRead);

exports.api = functions.region('asia-southeast2').https.onRequest(app);

exports.createNotificationOnLike = functions
	.region('asia-southeast2')
	.firestore.document('likes/{id}')
	.onCreate((snapshot) => {
		return db
			.doc(`/posts/${snapshot.data().postId}`)
			.get()
			.then((doc) => {
				if (doc.exists && doc.data().username !== snapshot.data().username) {
					return db.doc(`/notifications/${snapshot.id}`).set({
						createdAt: new Date().toISOString(),
						recipient: doc.data().username,
						sender: snapshot.data().username,
						type: 'like',
						read: false,
						postId: doc.id
					});
				}
			})
			.catch((err) => console.error(err));
	});

exports.deleteNotificationOnUnLike = functions
	.region('asia-southeast2')
	.firestore.document('likes/{id}')
	.onDelete((snapshot) => {
		return db
			.doc(`/notifications/${snapshot.id}`)
			.delete()
			.catch((err) => {
				console.error(err);
				return;
			});
	});
exports.createNotificationOnComment = functions
	.region('asia-southeast2')
	.firestore.document('comments/{id}')
	.onCreate((snapshot) => {
		return db
			.doc(`/posts/${snapshot.data().postId}`)
			.get()
			.then((doc) => {
				if (doc.exists && doc.data().username !== snapshot.data().username) {
					return db.doc(`/notifications/${snapshot.id}`).set({
						createdAt: new Date().toISOString(),
						recipient: doc.data().username,
						sender: snapshot.data().username,
						type: 'comment',
						read: false,
						postId: doc.id
					});
				}
			})
			.catch((err) => {
				console.error(err);
				return;
			});
	});

exports.onUserImageChange = functions
	.region('asia-southeast2')
	.firestore.document('/user/{userId}')
	.onUpdate((change) => {
		console.log(change.before.data());
		console.log(change.after.data());
		if (change.before.data().imageUrl !== change.after.data().imageUrl) {
			console.log('image has changed');
			const batch = db.batch();
			return db
				.collection('posts')
				.where('username', '==', change.before.data().username)
				.get()
				.then((data) => {
					data.forEach((doc) => {
						const post = db.doc(`/posts/${doc.id}`);
						batch.update(post, { userImage: change.after.data().imageUrl });
					});
					return batch.commit();
				});
		} else return true;
	});

exports.onPostdeleted = functions
	.region('asia-southeast2')
	.firestore.document('/posts/{postId}')
	.onDelete((snapshot, context) => {
		const postId = context.params.postId;
		const batch = db.batch();
		return db
			.collection('comments')
			.where('postId', '==', postId)
			.get()
			.then((data) => {
				data.forEach((doc) => {
					batch.delete(db.doc(`/comments/${doc.id}`));
				});
				return db.collection('likes').where('postId', '==', postId).get();
			})
			.then((data) => {
				data.forEach((doc) => {
					batch.delete(db.doc(`/likes/${doc.id}`));
				});
				return db
					.collection('notifications')
					.where('postId', '==', postId)
					.get();
			})
			.then((data) => {
				data.forEach((doc) => {
					batch.delete(db.doc(`/likes/${doc.id}`));
				});
				return batch.commit();
			})
			.catch((err) => console.error(err));
	});
