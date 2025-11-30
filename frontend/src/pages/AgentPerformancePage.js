import { useState, useEffect } from 'react';
import axios from 'axios';
import { API } from '../App';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Progress } from '../components/ui/progress';
import { toast } from 'sonner';
import { TrendingUp, Clock, CheckCircle } from 'lucide-react';

export default function AgentPerformancePage({ user }) {
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchStats();
  }, []);

  const fetchStats = async () => {
    try {
      const response = await axios.get(`${API}/statistics/agent/${user.id}`);
      setStats(response.data);
    } catch (error) {
      toast.error('Failed to fetch performance data');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return <div className="text-center py-12">Loading...</div>;
  }

  if (!stats) {
    return <div className="text-center py-12">No data available</div>;
  }

  const completionRate = stats.total_tickets > 0 ? (stats.completed_tickets / stats.total_tickets) * 100 : 0;

  return (
    <div className="space-y-6" data-testid="performance-page">
      <div>
        <h1 className="text-3xl font-bold text-slate-900">My Performance</h1>
        <p className="text-slate-500 mt-1">Track your ticket completion statistics</p>
      </div>

      {/* Performance Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-slate-500">Total Tickets</p>
                <p className="text-3xl font-bold text-slate-900 mt-2" data-testid="stat-total-tickets">
                  {stats.total_tickets}
                </p>
              </div>
              <div className="bg-blue-100 p-4 rounded-xl">
                <TrendingUp className="w-8 h-8 text-blue-600" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-slate-500">Completed</p>
                <p className="text-3xl font-bold text-slate-900 mt-2" data-testid="stat-completed">
                  {stats.completed_tickets}
                </p>
              </div>
              <div className="bg-green-100 p-4 rounded-xl">
                <CheckCircle className="w-8 h-8 text-green-600" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-slate-500">In Progress</p>
                <p className="text-3xl font-bold text-slate-900 mt-2" data-testid="stat-in-progress">
                  {stats.in_progress_tickets}
                </p>
              </div>
              <div className="bg-yellow-100 p-4 rounded-xl">
                <Clock className="w-8 h-8 text-yellow-600" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-slate-500">Avg Time (hours)</p>
                <p className="text-3xl font-bold text-slate-900 mt-2" data-testid="stat-avg-time">
                  {stats.avg_completion_time_hours.toFixed(1)}
                </p>
              </div>
              <div className="bg-purple-100 p-4 rounded-xl">
                <Clock className="w-8 h-8 text-purple-600" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Detailed Stats */}
      <Card>
        <CardHeader>
          <CardTitle>Performance Overview</CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="flex items-center gap-4">
            <div className="w-20 h-20 rounded-full bg-gradient-to-br from-blue-500 to-blue-600 flex items-center justify-center text-white font-bold text-xl">
              {user.username.substring(0, 2).toUpperCase()}
            </div>
            <div className="flex-1">
              <h3 className="text-2xl font-bold text-slate-900">{user.username}</h3>
              <p className="text-slate-500">Agent Performance</p>
            </div>
            <div className="text-right">
              <div className="text-4xl font-bold text-blue-600">{stats.rating.toFixed(1)}</div>
              <p className="text-sm text-slate-500">Rating</p>
            </div>
          </div>

          <div className="space-y-4">
            <div>
              <div className="flex justify-between mb-2">
                <span className="text-sm font-medium text-slate-700">Completion Rate</span>
                <span className="text-sm font-medium text-slate-900">
                  {completionRate.toFixed(1)}%
                </span>
              </div>
              <Progress value={completionRate} className="h-3" />
            </div>

            <div className="grid grid-cols-2 gap-4 pt-4">
              <div className="p-4 bg-slate-50 rounded-lg">
                <p className="text-sm text-slate-500 mb-1">Total Assigned</p>
                <p className="text-2xl font-bold text-slate-900">{stats.total_tickets}</p>
              </div>
              <div className="p-4 bg-green-50 rounded-lg">
                <p className="text-sm text-slate-500 mb-1">Successfully Completed</p>
                <p className="text-2xl font-bold text-green-600">{stats.completed_tickets}</p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
