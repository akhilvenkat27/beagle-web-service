import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { commentsAPI } from '../services/api';

const CommentThread = ({ taskId, onCommentCountChange }) => {
  const { user } = useAuth();
  const [comments, setComments] = useState([]);
  const [newComment, setNewComment] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!taskId) return; // BUG 2 FIX: Don't fetch if taskId is undefined
    fetchComments();
  }, [taskId]);

  // Notify parent component when comment count changes
  useEffect(() => {
    if (onCommentCountChange) {
      onCommentCountChange(taskId, comments.length);
    }
  }, [comments.length, taskId, onCommentCountChange]);

  const fetchComments = async () => {
    if (!taskId) return; // double-guard in case called manually before taskId is set
    try {
      setLoading(true);
      setError('');
      const response = await commentsAPI.getByTask(taskId);
      // Backend now returns array directly
      setComments(Array.isArray(response.data) ? response.data : []);
    } catch (err) {
      console.error('Comment fetch error:', err.response?.data?.message || err.message);
      setError(err.response?.data?.message || 'Failed to load comments');
    } finally {
      setLoading(false);
    }
  };

  const handleAddComment = async (e) => {
    e.preventDefault();
    if (!newComment.trim()) return;

    try {
      setError('');
      await commentsAPI.add(taskId, newComment);
      setNewComment('');
      await fetchComments();
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to add comment');
    }
  };

  const handleDeleteComment = async (commentId) => {
    if (!window.confirm('Delete this comment?')) return;

    try {
      await commentsAPI.delete(commentId);
      await fetchComments();
    } catch (err) {
      setError('Failed to delete comment');
    }
  };

  const canDeleteComment = (comment) => {
    return user.role === 'admin' || comment.userId._id === user._id;
  };

  return (
    <div className="mt-6 p-4 bg-ink-50 rounded-lg border border-ink-200">
      <h3 className="font-semibold text-ink-800 mb-4">Comments ({comments.length})</h3>

      {error && (
        <div className="p-3 mb-4 bg-risk-100 border border-risk-400 text-risk-700 rounded text-sm">
          {error}
        </div>
      )}

      {/* Add Comment Form */}
      <form onSubmit={handleAddComment} className="mb-4">
        <textarea
          value={newComment}
          onChange={(e) => setNewComment(e.target.value)}
          maxLength={500}
          placeholder="Add a comment..."
          className="w-full p-3 border border-ink-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-focus-500 text-sm"
          rows="3"
        />
        <div className="flex justify-between items-center mt-2">
          <span className="text-xs text-ink-500">{newComment.length}/500</span>
          <button
            type="submit"
            disabled={!newComment.trim()}
            className="bg-focus-600 hover:bg-focus-700 disabled:bg-ink-400 text-paper px-4 py-2 rounded text-sm font-medium transition"
          >
            Post Comment
          </button>
        </div>
      </form>

      {/* Comments List */}
      <div className="space-y-3">
        {loading ? (
          <p className="text-ink-500 text-sm">Loading comments...</p>
        ) : comments.length === 0 ? (
          <p className="text-ink-500 text-sm italic">No comments yet</p>
        ) : (
          comments.map((comment) => (
            <div key={comment._id} className="p-3 bg-paper rounded border border-ink-200">
              <div className="flex justify-between items-start mb-1">
                <div>
                  <strong className="text-sm text-ink-800">{comment.userId.name}</strong>
                  <span className="text-xs text-ink-500 ml-2">
                    {new Date(comment.createdAt).toLocaleDateString()}
                  </span>
                </div>
                {canDeleteComment(comment) && (
                  <button
                    onClick={() => handleDeleteComment(comment._id)}
                    className="text-xs text-risk-500 hover:text-risk-700 font-medium"
                  >
                    Delete
                  </button>
                )}
              </div>
              <p className="text-sm text-ink-700">{comment.text}</p>
            </div>
          ))
        )}
      </div>
    </div>
  );
};

export default CommentThread;
