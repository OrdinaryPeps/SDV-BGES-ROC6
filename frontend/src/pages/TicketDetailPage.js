import { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import { API, isAdminRole } from '../App';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Badge } from '../components/ui/badge';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Textarea } from '../components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../components/ui/select';
import { useParams, useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { ArrowLeft, User, Clock, Tag, MessageSquare, Send, Image, X, Loader2 } from 'lucide-react';
import { format } from 'date-fns';

export default function TicketDetailPage({ user }) {
  const { ticketId } = useParams();
  const navigate = useNavigate();
  const [ticket, setTicket] = useState(null);
  const [comments, setComments] = useState([]);
  const [newComment, setNewComment] = useState('');
  const [loading, setLoading] = useState(true);
  const [agents, setAgents] = useState([]);
  const [imageFiles, setImageFiles] = useState([]);
  const [imagePreviews, setImagePreviews] = useState([]);
  const [uploadingImage, setUploadingImage] = useState(false);
  const fileInputRef = useRef(null);;

  useEffect(() => {
    fetchTicket();
    fetchComments();
    if (user.role === 'admin') {
      fetchAgents();
    }
  }, [ticketId]);

  // Auto-refresh comments every 10 seconds
  useEffect(() => {
    const interval = setInterval(() => {
      fetchComments();
    }, 10000); // 10 seconds

    return () => clearInterval(interval);
  }, [ticketId]);

  const fetchTicket = async () => {
    try {
      const response = await axios.get(`${API}/tickets/${ticketId}`);
      setTicket(response.data);
    } catch (error) {
      toast.error('Failed to fetch ticket');
    } finally {
      setLoading(false);
    }
  };

  const fetchComments = async () => {
    try {
      const response = await axios.get(`${API}/tickets/${ticketId}/comments`);
      setComments(response.data);
    } catch (error) {
      console.error('Failed to fetch comments');
    }
  };

  const fetchAgents = async () => {
    try {
      const response = await axios.get(`${API}/users/agents`);
      setAgents(response.data);
    } catch (error) {
      console.error('Failed to fetch agents');
    }
  };

  const handleStatusUpdate = async (status) => {
    try {
      await axios.put(`${API}/tickets/${ticketId}`, { status });
      toast.success('Status updated successfully');
      fetchTicket();
    } catch (error) {
      if (error.response?.status === 409) {
        toast.error(error.response.data.detail || 'Ticket sudah diambil oleh agent lain');
      } else {
        toast.error('Failed to update status');
      }
    }
  };

  const handleAssignAgent = async (agentId) => {
    const agent = agents.find((a) => a.id === agentId);
    try {
      const updateData = agentId === 'none'
        ? { assigned_agent: null, assigned_agent_name: null }
        : { assigned_agent: agentId, assigned_agent_name: agent?.full_name || agent?.username };

      await axios.put(`${API}/tickets/${ticketId}`, updateData);
      toast.success(agentId === 'none' ? 'Agent unassigned - ticket available for claim' : 'Agent assigned successfully');
      fetchTicket();
    } catch (error) {
      if (error.response?.status === 409) {
        toast.error(error.response.data.detail || 'Ticket sudah diambil oleh agent lain');
      } else {
        toast.error('Failed to assign agent');
      }
    }
  };

  const handleAddComment = async (e) => {
    e.preventDefault();
    if (!newComment.trim() && imageFiles.length === 0) return;

    let uploadedImages = [];

    // Upload all images first
    if (imageFiles.length > 0) {
      setUploadingImage(true);
      try {
        for (const file of imageFiles) {
          const formData = new FormData();
          formData.append('file', file);
          const uploadRes = await axios.post(`${API}/uploads/upload`, formData, {
            headers: { 'Content-Type': 'multipart/form-data' }
          });
          uploadedImages.push({
            image_url: uploadRes.data.original_url,
            thumbnail_url: uploadRes.data.thumbnail_url
          });
        }
      } catch (error) {
        toast.error('Gagal upload gambar');
        setUploadingImage(false);
        return;
      }
      setUploadingImage(false);
    }

    try {
      await axios.post(`${API}/tickets/${ticketId}/comments`, {
        comment: newComment || '[Gambar]',
        images: uploadedImages.length > 0 ? uploadedImages : null
      });
      toast.success('Comment added successfully');
      setNewComment('');
      setImageFiles([]);
      setImagePreviews([]);
      fetchComments();
    } catch (error) {
      toast.error('Failed to add comment');
    }
  };

  const handlePaste = (e) => {
    const items = e.clipboardData?.items;
    if (!items) return;

    for (let item of items) {
      if (item.type.startsWith('image/')) {
        e.preventDefault();
        const file = item.getAsFile();
        if (file) {
          setImageFiles(prev => [...prev, file]);
          const reader = new FileReader();
          reader.onload = (e) => setImagePreviews(prev => [...prev, e.target.result]);
          reader.readAsDataURL(file);
        }
        break;
      }
    }
  };

  const handleFileSelect = (e) => {
    const files = Array.from(e.target.files || []);
    const validFiles = files.filter(f => f.type.startsWith('image/'));

    validFiles.forEach(file => {
      setImageFiles(prev => [...prev, file]);
      const reader = new FileReader();
      reader.onload = (e) => setImagePreviews(prev => [...prev, e.target.result]);
      reader.readAsDataURL(file);
    });
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const removeImage = (index) => {
    setImageFiles(prev => prev.filter((_, i) => i !== index));
    setImagePreviews(prev => prev.filter((_, i) => i !== index));
  };

  const handleDeleteTicket = async () => {
    if (!window.confirm('Are you sure you want to delete this ticket?')) return;

    try {
      await axios.delete(`${API}/tickets/${ticketId}`);
      toast.success('Ticket deleted successfully');
      navigate('/tickets');
    } catch (error) {
      toast.error('Failed to delete ticket');
    }
  };

  if (loading) {
    return <div className="text-center py-12">Loading...</div>;
  }

  if (!ticket) {
    return <div className="text-center py-12">Ticket not found</div>;
  }

  const getStatusBadge = (status) => {
    const variants = {
      open: 'bg-orange-100 text-orange-700',
      pending: 'bg-yellow-100 text-yellow-700',
      in_progress: 'bg-blue-100 text-blue-700',
      completed: 'bg-green-100 text-green-700'
    };
    return variants[status] || 'bg-slate-100 text-slate-700';
  };

  return (
    <div className="space-y-6" data-testid="ticket-detail-page">
      <div className="flex items-center justify-between">
        <Button
          variant="outline"
          onClick={() => navigate('/tickets')}
          className="gap-2"
          data-testid="back-button"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Tickets
        </Button>
        {isAdminRole(user.role) && (
          <Button
            variant="destructive"
            onClick={handleDeleteTicket}
            data-testid="delete-ticket-button"
          >
            Delete Ticket
          </Button>
        )}
      </div>

      {/* Ticket Info */}
      <Card>
        <CardHeader>
          <div className="flex items-start justify-between">
            <div>
              <CardTitle className="text-2xl">{ticket.ticket_number}</CardTitle>
              <div className="flex items-center gap-2 mt-2">
                <Badge className={getStatusBadge(ticket.status)}>
                  {ticket.status.replace('_', ' ')}
                </Badge>
              </div>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <Label className="text-sm text-slate-500">Category</Label>
              <p className="text-slate-900 font-medium mt-1">
                {ticket.category}
                {ticket.permintaan && (
                  <span className="text-blue-600"> - {ticket.permintaan}</span>
                )}
              </p>
            </div>
            <div>
              <Label className="text-sm text-slate-500">Created At</Label>
              <p className="text-slate-900 font-medium mt-1">
                {format(new Date(ticket.created_at), 'MMM dd, yyyy HH:mm')}
              </p>
            </div>
            {ticket.user_telegram_name && (
              <div>
                <Label className="text-sm text-slate-500">Telegram User</Label>
                <p className="text-slate-900 font-medium mt-1">{ticket.user_telegram_name}</p>
              </div>
            )}
            {ticket.assigned_agent_name && (
              <div>
                <Label className="text-sm text-slate-500">Assigned Agent</Label>
                <p className="text-slate-900 font-medium mt-1">{ticket.assigned_agent_name}</p>
              </div>
            )}
          </div>

          <div>
            <Label className="text-sm text-slate-500">Description</Label>
            <div className="text-slate-900 mt-1">
              {ticket.description && ticket.description.includes('\n') ? (
                <ul className="list-disc list-inside space-y-1">
                  {ticket.description.split('\n').filter(line => line.trim()).map((line, idx) => (
                    <li key={idx} className="text-slate-700">{line.trim()}</li>
                  ))}
                </ul>
              ) : (
                <p className="text-slate-700">{ticket.description}</p>
              )}
            </div>
          </div>

          {user.role === 'admin' && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-4 border-t">
              <div>
                <Label>Update Status</Label>
                <Select value={ticket.status} onValueChange={handleStatusUpdate}>
                  <SelectTrigger data-testid="status-select">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="open">Open</SelectItem>
                    <SelectItem value="pending">Pending</SelectItem>
                    <SelectItem value="in_progress">In Progress</SelectItem>
                    <SelectItem value="completed">Completed</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Assign Agent</Label>
                <Select
                  value={ticket.assigned_agent || 'none'}
                  onValueChange={handleAssignAgent}
                >
                  <SelectTrigger data-testid="agent-select">
                    <SelectValue placeholder="Select agent" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">No Assign (Available for Claim)</SelectItem>
                    {agents.map((agent) => (
                      <SelectItem key={agent.id} value={agent.id}>
                        {agent.username}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          )}

          {user.role === 'agent' && (
            <div className="pt-4 border-t">
              <Label>Update Status</Label>
              <Select value={ticket.status} onValueChange={handleStatusUpdate}>
                <SelectTrigger data-testid="agent-status-select">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="in_progress">In Progress</SelectItem>
                  <SelectItem value="pending">Pending</SelectItem>
                  <SelectItem value="completed">Completed</SelectItem>
                </SelectContent>
              </Select>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Comments */}
      <Card>
        <CardHeader>
          <CardTitle>Comments</CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          {comments.length === 0 ? (
            <p className="text-center text-slate-500 py-8">No comments yet</p>
          ) : (
            <div className="space-y-4">
              {comments.map((comment) => (
                <div key={comment.id} className="flex gap-3" data-testid={`comment-${comment.id}`}>
                  <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-500 to-blue-600 flex items-center justify-center text-white font-bold text-sm flex-shrink-0">
                    {comment.username.substring(0, 2).toUpperCase()}
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <p className="font-semibold text-slate-900">{comment.username}</p>
                      <Badge variant="outline" className="text-xs">
                        {comment.role}
                      </Badge>
                      <span className="text-xs text-slate-500">
                        {format(new Date(comment.timestamp), 'MMM dd, HH:mm')}
                      </span>
                    </div>
                    <p className="text-slate-700">{comment.comment}</p>
                    {comment.images && comment.images.length > 0 && (
                      <div className="mt-2 flex flex-wrap gap-2">
                        {comment.images.map((img, idx) => (
                          <a
                            key={idx}
                            href={`${API}${img.image_url}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-block"
                          >
                            <img
                              src={`${API}${img.thumbnail_url}`}
                              alt={`Attachment ${idx + 1}`}
                              className="max-w-[150px] rounded-lg border hover:opacity-90 transition-opacity cursor-pointer"
                              onError={(e) => { e.target.style.display = 'none'; }}
                            />
                          </a>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Add Comment Form */}
          <form onSubmit={handleAddComment} className="pt-4 border-t">
            <Label>Add Comment</Label>
            <div className="mt-2">
              <Textarea
                value={newComment}
                onChange={(e) => setNewComment(e.target.value)}
                onPaste={handlePaste}
                placeholder="Ketik komentar atau Ctrl+V untuk paste gambar..."
                className="w-full"
                rows={3}
                data-testid="comment-input"
              />

              {/* Image Previews */}
              {imagePreviews.length > 0 && (
                <div className="mt-2 flex flex-wrap gap-2">
                  {imagePreviews.map((preview, index) => (
                    <div key={index} className="relative inline-block">
                      <img
                        src={preview}
                        alt={`Preview ${index + 1}`}
                        className="max-w-[100px] max-h-24 rounded border"
                      />
                      <button
                        type="button"
                        onClick={() => removeImage(index)}
                        className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full p-1 hover:bg-red-600"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="flex gap-2 mt-3">
              <input
                type="file"
                accept="image/*"
                multiple
                onChange={handleFileSelect}
                ref={fileInputRef}
                className="hidden"
              />
              <Button
                type="button"
                variant="outline"
                onClick={() => fileInputRef.current?.click()}
              >
                <Image className="w-4 h-4 mr-2" />
                Attach
              </Button>
              <Button type="submit" className="gap-2" disabled={uploadingImage || (!newComment.trim() && imageFiles.length === 0)} data-testid="add-comment-button">
                {uploadingImage ? (
                  <><Loader2 className="w-4 h-4 animate-spin" /> Uploading...</>
                ) : (
                  <><Send className="w-4 h-4" /> Send</>
                )}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
