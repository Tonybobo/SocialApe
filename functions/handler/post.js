const { db } = require('../util/admin');

exports.getAllPost = (req, res) => {
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
};
exports.getPost = (req, res) => {
	let postData = {};
	db.doc(`/posts/${req.params.postId}`)
		.get()
		.then((doc) => {
			if (!doc.exists) {
				return res.status(404).json({ error: 'Post not Found' });
			}
			postData = doc.data();
			postData.postId = doc.id;
			return db
				.collection('comments')
				.orderBy('createdAt', 'desc')
				.where('postId', '==', req.params.postId)
				.get();
		})
		.then((data) => {
			postData.comments = [];
			data.forEach((doc) => {
				postData.comments.push(doc.data());
			});
			return res.json(postData);
		})
		.catch((err) => {
			console.error(err);
			res.status(500).json({
				error: err.code
			});
		});
};

exports.PostOnePost = (req, res) => {
	if (req.body.body.trim() === '') {
		return res.status(400).json({ body: 'Post must not be empty' });
	}

	const newPost = {
		body: req.body.body,
		username: req.user.username,
		createdAt: new Date().toISOString(),
		userImage: req.user.imageUrl,
		likeCount: 0,
		commentCount: 0
	};
	db.collection('posts')
		.add(newPost)
		.then((doc) => {
			const resPost = newPost;
			resPost.postId = doc.id;
			res.json(resPost);
		})
		.catch((err) => {
			res.status(500).json({
				error: 'something went wrong'
			});
			console.error(err);
		});
};

exports.commentOnPost = (req, res) => {
	if (req.body.body.trim() === '')
		return res.status(400).json({ error: 'Must not be empty' });

	const newComment = {
		body: req.body.body,
		createdAt: new Date().toISOString(),
		postId: req.params.postId,
		username: req.user.username,
		userImage: req.user.imageUrl
	};

	db.doc(`/posts/${req.params.postId}`)
		.get()
		.then((doc) => {
			if (!doc.exists) {
				return res.status(404).json({ error: 'Post not found' });
			}
			return doc.ref.update({ commentCount: doc.data().commentCount + 1 });
		})
		.then(() => {
			return db.collection('comments').add(newComment);
		})
		.then(() => {
			res.json(newComment);
		})
		.catch((err) => {
			console.error(err);
			res.status(500).json({ error: 'Something went wrong' });
		});
};
exports.likePost = (req, res) => {
	const likeDocument = db
		.collection('likes')
		.where('username', '==', req.user.username)
		.where('postId', '==', req.params.postId)
		.limit(1);

	const postDocument = db.doc(`/posts/${req.params.postId}`);

	let postData;

	postDocument
		.get()
		.then((doc) => {
			if (doc.exists) {
				postData = doc.data();
				postData.postId = doc.id;
				return likeDocument.get();
			} else {
				return res.status(404).json({ error: 'Post not Found' });
			}
		})
		.then((data) => {
			if (data.empty) {
				return db
					.collection('likes')
					.add({
						postId: req.params.postId,
						username: req.user.username
					})
					.then(() => {
						postData.likeCount++;
						return postDocument.update({ likeCount: postData.likeCount });
					})
					.then(() => {
						res.json(postData);
					});
			} else {
				return res.status(400).json({ error: 'Post already like' });
			}
		})
		.catch((err) => {
			res.status(500).json({ error: err.code });
		});
};

exports.unlikePost = (req, res) => {
	const likeDocument = db
		.collection('likes')
		.where('username', '==', req.user.username)
		.where('postId', '==', req.params.postId)
		.limit(1);

	const postDocument = db.doc(`/posts/${req.params.postId}`);

	let postData;

	postDocument
		.get()
		.then((doc) => {
			if (doc.exists) {
				postData = doc.data();
				postData.postId = doc.id;
				return likeDocument.get();
			} else {
				return res.status(404).json({ error: 'Post not Found' });
			}
		})
		.then((data) => {
			if (data.empty) {
				return res.status(400).json({ error: 'Post not like' });
			} else {
				return db
					.doc(`/likes/${data.docs[0].id}`)
					.delete()
					.then(() => {
						postData.likeCount--;
						return postDocument.update({ likeCount: postData.likeCount });
					})
					.then(() => {
						res.json(postData);
					});
			}
		})
		.catch((err) => {
			res.status(500).json({ error: err.code });
		});
};

//delete post

exports.deletePost = (req, res) => {
	const document = db.doc(`/posts/${req.params.postId}`);
	document
		.get()
		.then((doc) => {
			if (!doc.exists) {
				return res.status(404).json({ error: 'Post not found' });
			}
			if (doc.data().username !== req.user.username) {
				return res.status(403).json({ error: 'Unauthorized' });
			} else {
				return document.delete();
			}
		})
		.then(() => {
			res.json({ message: 'Post deleted successfully' });
		})
		.catch((err) => {
			console.error(err);
			return res.status(500).json({ error: err.code });
		});
};
