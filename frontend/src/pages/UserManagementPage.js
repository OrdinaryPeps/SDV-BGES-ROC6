import { useState, useEffect } from 'react';
import axios from 'axios';
import { API } from '../App';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Badge } from '../components/ui/badge';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '../components/ui/dialog';
import { toast } from 'sonner';
import { Check, X, UserCheck, UserX, KeyRound, Trash2 } from 'lucide-react';
import { format } from 'date-fns';

export default function UserManagementPage({ user }) {
  const [pendingUsers, setPendingUsers] = useState([]);
  const [agents, setAgents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [resetPasswordDialog, setResetPasswordDialog] = useState(null);
  const [newPassword, setNewPassword] = useState('');

  useEffect(() => {
    fetchPendingUsers();
    fetchAgents();
  }, []);

  const fetchPendingUsers = async () => {
    try {
      const response = await axios.get(`${API}/users/pending`);
      setPendingUsers(response.data);
    } catch (error) {
      toast.error('Failed to fetch pending users');
    } finally {
      setLoading(false);
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

  const handleApproveUser = async (userId, role) => {
    try {
      await axios.put(`${API}/users/${userId}/approve?role=${role}`);
      toast.success(`User approved as ${role}`);
      fetchPendingUsers();
      fetchAgents();
    } catch (error) {
      toast.error('Failed to approve user');
    }
  };

  const handleDeleteUser = async (userId) => {
    try {
      await axios.delete(`${API}/users/${userId}`);
      toast.success('User deleted successfully');
      fetchPendingUsers();
    } catch (error) {
      toast.error('Failed to delete user');
    }
  };

  const handleResetPassword = async () => {
    if (!newPassword || newPassword.length < 6) {
      toast.error('Password must be at least 6 characters');
      return;
    }

    try {
      await axios.put(`${API}/users/${resetPasswordDialog}/reset-password`, {
        new_password: newPassword
      });
      toast.success('Password reset successfully!');
      setResetPasswordDialog(null);
      setNewPassword('');
    } catch (error) {
      toast.error('Failed to reset password');
    }
  };

  const handleDeleteAgent = async (agentId, agentUsername) => {
    if (!window.confirm(`Are you sure you want to delete agent "${agentUsername}"? This action cannot be undone.`)) {
      return;
    }

    try {
      await axios.delete(`${API}/users/${agentId}`);
      toast.success(`Agent ${agentUsername} deleted successfully`);
      fetchAgents();
    } catch (error) {
      toast.error('Failed to delete agent');
    }
  };

  if (loading) {
    return <div className="text-center py-12">Loading...</div>;
  }

  return (
    <div className="space-y-6" data-testid="user-management-page">
      <div>
        <h1 className="text-3xl font-bold text-slate-900">User Management</h1>
        <p className="text-slate-500 mt-1">Manage agent registrations and passwords</p>
      </div>

      {/* Pending Approvals */}
      <div>
        <h2 className="text-xl font-semibold text-slate-900 mb-4">Pending Approvals</h2>
        {pendingUsers.length === 0 ? (
          <Card>
            <CardContent className="py-12">
              <div className="text-center">
                <UserCheck className="w-12 h-12 text-slate-400 mx-auto mb-3" />
                <p className="text-slate-500">No pending user approvals</p>
              </div>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-4">
            {pendingUsers.map((pendingUser) => (
              <Card key={pendingUser.id} data-testid={`pending-user-${pendingUser.username}`}>
                <CardContent className="pt-6">
                  <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div className="flex items-center gap-4">
                      <div className="w-12 h-12 rounded-full bg-gradient-to-br from-blue-500 to-blue-600 flex items-center justify-center text-white font-bold text-lg flex-shrink-0">
                        {pendingUser.username.substring(0, 2).toUpperCase()}
                      </div>
                      <div>
                        <h3 className="text-lg font-semibold text-slate-900">
                          {pendingUser.full_name || pendingUser.username}
                          {pendingUser.full_name && <span className="text-sm font-normal text-slate-500 ml-2">({pendingUser.username})</span>}
                        </h3>
                        <div className="flex flex-wrap items-center gap-2 mt-1">
                          <Badge variant="outline" className="capitalize">
                            {pendingUser.role}
                          </Badge>
                          <Badge className="bg-yellow-100 text-yellow-700">
                            {pendingUser.status}
                          </Badge>
                          <span className="text-sm text-slate-500">
                            Registered: {format(new Date(pendingUser.created_at), 'MMM dd, yyyy')}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                  <div className="flex gap-2 mt-4 md:mt-0 md:ml-auto">
                    <Button
                      onClick={() => handleApproveUser(pendingUser.id, 'agent')}
                      className="bg-green-600 hover:bg-green-700"
                    >
                      <Check className="w-4 h-4 mr-2" />
                      Approve as Agent
                    </Button>
                    <Button
                      onClick={() => handleApproveUser(pendingUser.id, 'admin')}
                      className="bg-blue-600 hover:bg-blue-700"
                    >
                      <Check className="w-4 h-4 mr-2" />
                      Approve as Admin
                    </Button>
                    <Button
                      variant="destructive"
                      onClick={() => handleDeleteUser(pendingUser.id)}
                    >
                      <X className="w-4 h-4" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>

      {/* Agent List with Reset Password */}
      <div>
        <h2 className="text-xl font-semibold text-slate-900 mb-4">Agent List</h2>
        {agents.length === 0 ? (
          <Card>
            <CardContent className="py-12">
              <div className="text-center">
                <UserX className="w-12 h-12 text-slate-400 mx-auto mb-3" />
                <p className="text-slate-500">No agents available</p>
              </div>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-4">
            {agents.map((agent) => (
              <Card key={agent.id} data-testid={`agent-${agent.username}`}>
                <CardContent className="pt-6">
                  <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div className="flex items-center gap-4">
                      <div className="w-12 h-12 rounded-full bg-gradient-to-br from-blue-500 to-blue-600 flex items-center justify-center text-white font-bold text-lg flex-shrink-0">
                        {agent.username.substring(0, 2).toUpperCase()}
                      </div>
                      <div>
                        <h3 className="text-lg font-semibold text-slate-900">
                          {agent.full_name || agent.username}
                          {agent.full_name && <span className="text-sm font-normal text-slate-500 ml-2">({agent.username})</span>}
                        </h3>
                        <div className="flex flex-wrap items-center gap-2 mt-1">
                          <Badge variant="outline" className="capitalize">
                            {agent.role}
                          </Badge>
                          <Badge className="bg-green-100 text-green-700">
                            {agent.status}
                          </Badge>
                          <span className="text-sm text-slate-500">
                            Since: {format(new Date(agent.created_at), 'MMM dd, yyyy')}
                          </span>
                        </div>
                      </div>
                    </div>
                    <div className="flex gap-2 w-full md:w-auto justify-end">
                      <Dialog open={resetPasswordDialog === agent.id} onOpenChange={(open) => {
                        if (!open) {
                          setResetPasswordDialog(null);
                          setNewPassword('');
                        }
                      }}>
                        <DialogTrigger asChild>
                          <Button
                            onClick={() => setResetPasswordDialog(agent.id)}
                            variant="outline"
                            className="gap-2"
                            data-testid={`reset-password-${agent.username}`}
                          >
                            <KeyRound className="w-4 h-4" />
                            Reset Password
                          </Button>
                        </DialogTrigger>
                        <DialogContent>
                          <DialogHeader>
                            <DialogTitle>Reset Password for {agent.username}</DialogTitle>
                            <DialogDescription>
                              Enter a new password for this agent. They will need to use this password to login.
                            </DialogDescription>
                          </DialogHeader>
                          <div className="space-y-4 py-4">
                            <div className="space-y-2">
                              <Label htmlFor="new-password">New Password</Label>
                              <Input
                                id="new-password"
                                type="password"
                                value={newPassword}
                                onChange={(e) => setNewPassword(e.target.value)}
                                placeholder="Enter new password (min. 6 characters)"
                                data-testid="reset-password-input"
                              />
                            </div>
                            <div className="flex gap-2 justify-end">
                              <Button
                                variant="outline"
                                onClick={() => {
                                  setResetPasswordDialog(null);
                                  setNewPassword('');
                                }}
                              >
                                Cancel
                              </Button>
                              <Button
                                onClick={handleResetPassword}
                                data-testid="confirm-reset-password"
                              >
                                Reset Password
                              </Button>
                            </div>
                          </div>
                        </DialogContent>
                      </Dialog>
                      <Button
                        onClick={() => handleDeleteAgent(agent.id, agent.username)}
                        variant="destructive"
                        className="gap-2"
                        data-testid={`delete-agent-${agent.username}`}
                      >
                        <Trash2 className="w-4 h-4" />
                        Delete
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
