import { useState, useEffect } from 'react';
import axios from 'axios';
import { API } from '../App';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Ticket, Clock, CheckCircle, AlertCircle, TrendingUp, Download, FileSpreadsheet } from 'lucide-react';
import { toast } from 'sonner';
import { Progress } from '../components/ui/progress';
import { Button } from '../components/ui/button';
import { useNavigate } from 'react-router-dom';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../components/ui/table';
import { Skeleton } from '../components/ui/skeleton';

export default function DashboardPage({ user }) {
  const [stats, setStats] = useState(null);
  const [agentStats, setAgentStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  // Performance Report states (Admin only)
  const [agents, setAgents] = useState([]);
  const [categories, setCategories] = useState([]);
  const [years, setYears] = useState([]);
  const currentYear = new Date().getFullYear().toString();
  const currentMonth = (new Date().getMonth() + 1).toString();
  const [selectedYear, setSelectedYear] = useState(currentYear);
  const [selectedMonth, setSelectedMonth] = useState(currentMonth);
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [selectedAgent, setSelectedAgent] = useState('all');
  const [performanceData, setPerformanceData] = useState([]);
  const [performanceSummary, setPerformanceSummary] = useState(null);
  const [loadingPerformance, setLoadingPerformance] = useState(false);
  const [hasInitialLoad, setHasInitialLoad] = useState(false);

  // New Performance Report tables
  const [performanceByAgent, setPerformanceByAgent] = useState({ data: [], grand_total: null });
  const [performanceByProduct, setPerformanceByProduct] = useState({ data: [], grand_total: null });
  const [loadingByAgent, setLoadingByAgent] = useState(false);
  const [loadingByProduct, setLoadingByProduct] = useState(false);

  useEffect(() => {
    console.log('DashboardPage v0.1.3 loaded');
    fetchStats();
    if (user.role === 'admin') {
      fetchAgents();
      fetchCategories();
      fetchYears();
    }
  }, []);

  // Auto-load performance data on mount (with current year/month defaults)
  useEffect(() => {
    if (user.role === 'admin' && !hasInitialLoad) {
      // Delay initial load to ensure filters are set
      const timer = setTimeout(() => {
        handleLoadReport();
        setHasInitialLoad(true);
      }, 500);
      return () => clearTimeout(timer);
    }
  }, [user.role]);

  // Auto-reload when filters change (with debounce)
  useEffect(() => {
    if (user.role === 'admin' && hasInitialLoad) {
      const timer = setTimeout(() => {
        handleLoadReport();
      }, 500); // 500ms debounce
      return () => clearTimeout(timer);
    }
  }, [selectedYear, selectedMonth, selectedCategory, selectedAgent]);

  const handleLoadReport = () => {
    fetchPerformanceData();
    fetchPerformanceByAgent();
    fetchPerformanceByProduct();
  };

  const fetchStats = async () => {
    try {
      if (user.role === 'admin') {
        const response = await axios.get(`${API}/statistics/admin-dashboard`);
        setStats(response.data);
      } else {
        // Agent dashboard - get their own ticket stats
        const response = await axios.get(`${API}/statistics/agent-dashboard/${user.id}`);
        setAgentStats(response.data);
      }
    } catch (error) {
      toast.error('Failed to fetch statistics');
    } finally {
      setLoading(false);
    }
  };

  const fetchAgents = async () => {
    try {
      const response = await axios.get(`${API}/users/agents`);
      console.log('Agents response:', response.data);
      if (Array.isArray(response.data)) {
        setAgents(response.data);
      } else {
        console.error('Agents data is not an array:', response.data);
        setAgents([]);
      }
    } catch (error) {
      console.error('Failed to fetch agents:', error);
    }
  };

  const fetchCategories = async () => {
    try {
      const response = await axios.get(`${API}/tickets/categories`);
      setCategories(response.data?.categories || []);
    } catch (error) {
      console.error('Failed to fetch categories:', error);
    }
  };

  const fetchYears = async () => {
    try {
      const response = await axios.get(`${API}/tickets/years`);
      setYears(response.data?.years || []);
    } catch (error) {
      console.error('Failed to fetch years:', error);
    }
  };

  const fetchPerformanceData = async () => {
    const hasYearFilter = selectedYear && selectedYear !== 'all';
    const hasMonthFilter = selectedMonth && selectedMonth !== 'all';
    const hasCategoryFilter = selectedCategory && selectedCategory !== 'all';
    const hasAgentFilter = selectedAgent && selectedAgent !== 'all';

    // Allow fetching with default 'all' filters
    // if (!hasYearFilter && !hasMonthFilter && !hasCategoryFilter && !hasAgentFilter) {
    //   toast.error('Please select at least one filter');
    //   return;
    // }

    setLoadingPerformance(true);
    try {
      const params = new URLSearchParams();
      if (hasYearFilter) params.append('year', selectedYear);
      if (hasMonthFilter) params.append('month', selectedMonth);
      if (hasCategoryFilter) params.append('category', selectedCategory);
      if (hasAgentFilter) params.append('agent_id', selectedAgent);

      const response = await axios.get(`${API}/performance/table-data?${params.toString()}`);

      setPerformanceData(response.data.data);
      setPerformanceSummary(response.data.summary);
      toast.success('Performance data loaded');
    } catch (error) {
      toast.error('Failed to load performance data');
      console.error(error);
    } finally {
      setLoadingPerformance(false);
    }
  };

  const fetchPerformanceByAgent = async () => {
    setLoadingByAgent(true);
    try {
      const params = new URLSearchParams();
      if (selectedYear && selectedYear !== 'all') params.append('year', selectedYear);
      if (selectedMonth && selectedMonth !== 'all') params.append('month', selectedMonth);
      if (selectedCategory && selectedCategory !== 'all') params.append('category', selectedCategory);
      if (selectedAgent && selectedAgent !== 'all') params.append('agent_id', selectedAgent);

      const response = await axios.get(`${API}/performance/by-agent?${params.toString()}`);
      setPerformanceByAgent(response.data);
    } catch (error) {
      toast.error('Failed to load agent performance data');
      console.error(error);
    } finally {
      setLoadingByAgent(false);
    }
  };

  const fetchPerformanceByProduct = async () => {
    setLoadingByProduct(true);
    try {
      const params = new URLSearchParams();
      if (selectedYear && selectedYear !== 'all') params.append('year', selectedYear);
      if (selectedMonth && selectedMonth !== 'all') params.append('month', selectedMonth);
      if (selectedCategory && selectedCategory !== 'all') params.append('category', selectedCategory);
      if (selectedAgent && selectedAgent !== 'all') params.append('agent_id', selectedAgent);

      const response = await axios.get(`${API}/performance/by-product?${params.toString()}`);
      setPerformanceByProduct(response.data);
    } catch (error) {
      toast.error('Failed to load product performance data');
      console.error(error);
    } finally {
      setLoadingByProduct(false);
    }
  };

  const exportData = async (format = 'csv') => {
    try {
      const response = await axios.get(`${API}/export/tickets?format=${format}`, {
        responseType: 'blob'
      });
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      const extension = format === 'xlsx' ? 'xlsx' : 'csv';

      // Add date and year to filename
      const now = new Date();
      const dateStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;

      link.setAttribute('download', `tickets_export_${dateStr}.${extension}`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      toast.success(`Data exported successfully as ${extension.toUpperCase()}`);
    } catch (error) {
      toast.error('Failed to export data');
    }
  };

  const exportPerformanceReport = async (format = 'csv') => {
    const hasYearFilter = selectedYear && selectedYear !== 'all';
    const hasMonthFilter = selectedMonth && selectedMonth !== 'all';
    const hasCategoryFilter = selectedCategory && selectedCategory !== 'all';
    const hasAgentFilter = selectedAgent && selectedAgent !== 'all';

    if (!hasYearFilter && !hasMonthFilter && !hasCategoryFilter && !hasAgentFilter) {
      toast.error('Please select at least one filter');
      return;
    }

    try {
      const params = new URLSearchParams();
      if (hasYearFilter) params.append('year', selectedYear);
      if (hasMonthFilter) params.append('month', selectedMonth);
      if (hasCategoryFilter) params.append('category', selectedCategory);
      if (hasAgentFilter) params.append('agent_id', selectedAgent);
      params.append('format', format);

      const response = await axios.get(`${API}/export/performance?${params.toString()}`, {
        responseType: 'blob'
      });

      // Determine MIME type based on format
      const mimeType = format === 'xlsx'
        ? 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
        : 'text/csv';

      const url = window.URL.createObjectURL(new Blob([response.data], { type: mimeType }));
      const link = document.createElement('a');
      link.href = url;
      const extension = format === 'xlsx' ? 'xlsx' : 'csv';

      // Add date to filename
      const now = new Date();
      const dateStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;

      // Generate filename based on filters
      let filename = `performance_report_${dateStr}.${extension}`;
      try {
        const sanitize = (str) => String(str || '').replace(/[^a-z0-9]/gi, '_');

        const yearStr = hasYearFilter ? sanitize(selectedYear) : 'all';
        const monthStr = hasMonthFilter ? sanitize(selectedMonth) : 'all';
        const categoryStr = hasCategoryFilter ? sanitize(selectedCategory) : 'all';
        const agentStr = hasAgentFilter ? 'single_agent' : 'all_agents';

        filename = `performance_report_${yearStr}_${monthStr}_${categoryStr}_${agentStr}_${dateStr}.${extension}`;
      } catch (err) {
        console.error('Error generating filename:', err);
      }
      console.log('Final filename:', filename);

      link.setAttribute('download', filename);
      document.body.appendChild(link);
      link.click();
      link.remove();
      toast.success(`Performance report exported as ${extension.toUpperCase()}`);
    } catch (error) {
      toast.error('Failed to export performance report');
      console.error(error);
    }
  };

  const monthNames = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ];

  if (loading) {
    return <div className="text-center py-12">Loading...</div>;
  }

  // Agent Dashboard
  if (user.role === 'agent') {
    if (!agentStats) {
      return <div className="text-center py-12">No data available</div>;
    }

    return (
      <div className="space-y-6" data-testid="dashboard-page">
        <div>
          <h1 className="text-3xl font-bold text-slate-900">Dashboard</h1>
          <p className="text-slate-500 mt-1">Ringkasan statistik tiket Anda</p>
        </div>

        {/* Today Stats */}
        <div>
          <h2 className="text-xl font-semibold text-slate-900 mb-4">Today</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-slate-500">Tickets Received</p>
                    <p className="text-3xl font-bold text-slate-900 mt-2">{agentStats.today?.received || 0}</p>
                  </div>
                  <div className="bg-blue-100 p-4 rounded-xl">
                    <Ticket className="w-8 h-8 text-blue-600" />
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-slate-500">Completed Today</p>
                    <p className="text-3xl font-bold text-slate-900 mt-2">{agentStats.today?.completed || 0}</p>
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
                    <p className="text-3xl font-bold text-slate-900 mt-2">{agentStats.today?.in_progress || 0}</p>
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
                    <p className="text-sm font-medium text-slate-500">Pending</p>
                    <p className="text-3xl font-bold text-slate-900 mt-2">{agentStats.today?.pending || 0}</p>
                  </div>
                  <div className="bg-orange-100 p-4 rounded-xl">
                    <AlertCircle className="w-8 h-8 text-orange-600" />
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>

        {/* This Month Stats */}
        <div>
          <h2 className="text-xl font-semibold text-slate-900 mb-4">This Month</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-slate-500">Total Received</p>
                    <p className="text-3xl font-bold text-slate-900 mt-2">{agentStats.this_month?.received || 0}</p>
                  </div>
                  <div className="bg-blue-100 p-4 rounded-xl">
                    <Ticket className="w-8 h-8 text-blue-600" />
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-slate-500">Completed</p>
                    <p className="text-3xl font-bold text-slate-900 mt-2">{agentStats.this_month?.completed || 0}</p>
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
                    <p className="text-sm font-medium text-slate-500">Avg Time (hours)</p>
                    <p className="text-3xl font-bold text-slate-900 mt-2">{agentStats.this_month?.avg_time?.toFixed(1) || 0}</p>
                  </div>
                  <div className="bg-purple-100 p-4 rounded-xl">
                    <Clock className="w-8 h-8 text-purple-600" />
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-slate-500">Completion Rate</p>
                    <p className="text-3xl font-bold text-slate-900 mt-2">
                      {agentStats.this_month?.received > 0
                        ? Math.round((agentStats.this_month?.completed / agentStats.this_month?.received) * 100)
                        : 0}%
                    </p>
                  </div>
                  <div className="bg-indigo-100 p-4 rounded-xl">
                    <TrendingUp className="w-8 h-8 text-indigo-600" />
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>

        {/* Total Accumulation */}
        <div>
          <h2 className="text-xl font-semibold text-slate-900 mb-4">Total Accumulation</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-slate-500">All Time Tickets</p>
                    <p className="text-3xl font-bold text-slate-900 mt-2">{agentStats.total?.all_tickets || 0}</p>
                  </div>
                  <div className="bg-slate-100 p-4 rounded-xl">
                    <Ticket className="w-8 h-8 text-slate-600" />
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-slate-500">Total Completed</p>
                    <p className="text-3xl font-bold text-slate-900 mt-2">{agentStats.total?.completed || 0}</p>
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
                    <p className="text-sm font-medium text-slate-500">Overall Rate</p>
                    <p className="text-3xl font-bold text-slate-900 mt-2">
                      {agentStats.total?.all_tickets > 0
                        ? Math.round((agentStats.total?.completed / agentStats.total?.all_tickets) * 100)
                        : 0}%
                    </p>
                  </div>
                  <div className="bg-indigo-100 p-4 rounded-xl">
                    <TrendingUp className="w-8 h-8 text-indigo-600" />
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    );
  }

  // Admin Dashboard
  if (!stats) {
    return <div className="text-center py-12">No data available</div>;
  }

  return (
    <div className="space-y-6" data-testid="dashboard-page">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-slate-900">Dashboard</h1>
          <p className="text-slate-500 mt-1">Ringkasan sistem manajemen tiket</p>
        </div>
        {user.role === 'admin' && (
          <div className="flex gap-2">
            {/* Export buttons removed as per request */}
          </div>
        )}
      </div>

      {/* Today Stats */}
      <div>
        <h2 className="text-xl font-semibold text-slate-900 mb-4">Today</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-slate-500">Tickets Received</p>
                  <p className="text-3xl font-bold text-slate-900 mt-2">{stats.today?.received || 0}</p>
                </div>
                <div className="bg-blue-100 p-4 rounded-xl">
                  <Ticket className="w-8 h-8 text-blue-600" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-slate-500">Completed Today</p>
                  <p className="text-3xl font-bold text-slate-900 mt-2">{stats.today?.completed || 0}</p>
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
                  <p className="text-3xl font-bold text-slate-900 mt-2">{stats.today?.in_progress || 0}</p>
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
                  <p className="text-sm font-medium text-slate-500">Open</p>
                  <p className="text-3xl font-bold text-slate-900 mt-2">{stats.today?.open || 0}</p>
                </div>
                <div className="bg-orange-100 p-4 rounded-xl">
                  <AlertCircle className="w-8 h-8 text-orange-600" />
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* This Month Stats */}
      <div>
        <h2 className="text-xl font-semibold text-slate-900 mb-4">This Month</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-slate-500">Total Received</p>
                  <p className="text-3xl font-bold text-slate-900 mt-2">{stats.this_month?.received || 0}</p>
                </div>
                <div className="bg-blue-100 p-4 rounded-xl">
                  <Ticket className="w-8 h-8 text-blue-600" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-slate-500">Completed</p>
                  <p className="text-3xl font-bold text-slate-900 mt-2">{stats.this_month?.completed || 0}</p>
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
                  <p className="text-sm font-medium text-slate-500">Avg Time (hours)</p>
                  <p className="text-3xl font-bold text-slate-900 mt-2">{stats.this_month?.avg_time?.toFixed(1) || 0}</p>
                </div>
                <div className="bg-purple-100 p-4 rounded-xl">
                  <Clock className="w-8 h-8 text-purple-600" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-slate-500">Active Agents</p>
                  <p className="text-3xl font-bold text-slate-900 mt-2">{stats.this_month?.active_agents || 0}</p>
                </div>
                <div className="bg-indigo-100 p-4 rounded-xl">
                  <TrendingUp className="w-8 h-8 text-indigo-600" />
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Total Accumulation */}
      <div>
        <h2 className="text-xl font-semibold text-slate-900 mb-4">Total Accumulation</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-slate-500">All Time Tickets</p>
                  <p className="text-3xl font-bold text-slate-900 mt-2">{stats.total?.all_tickets || 0}</p>
                </div>
                <div className="bg-slate-100 p-4 rounded-xl">
                  <Ticket className="w-8 h-8 text-slate-600" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-slate-500">Total Completed</p>
                  <p className="text-3xl font-bold text-slate-900 mt-2">{stats.total?.completed || 0}</p>
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
                  <p className="text-sm font-medium text-slate-500">Total Agents</p>
                  <p className="text-3xl font-bold text-slate-900 mt-2">{stats.total?.total_agents || 0}</p>
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
                  <p className="text-sm font-medium text-slate-500">Completion Rate</p>
                  <p className="text-3xl font-bold text-slate-900 mt-2">
                    {stats.total?.all_tickets > 0
                      ? Math.round((stats.total?.completed / stats.total?.all_tickets) * 100)
                      : 0}%
                  </p>
                </div>
                <div className="bg-indigo-100 p-4 rounded-xl">
                  <TrendingUp className="w-8 h-8 text-indigo-600" />
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Performance Report Section */}
      <div className="mt-8 max-w-full">
        <Card className="overflow-hidden">
          <CardHeader>
            <CardTitle>Performance Report</CardTitle>
            <p className="text-sm text-slate-500">Filter dan ekspor data performa agen</p>
          </CardHeader>
          <CardContent className="overflow-hidden">
            <div className="space-y-4">
              {/* Filters */}
              <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
                <div>
                  <label className="text-sm font-medium text-slate-700 mb-2 block">Year</label>
                  <Select value={selectedYear} onValueChange={setSelectedYear}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select year" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Years</SelectItem>
                      {years?.map(year => (
                        <SelectItem key={year} value={year.toString()}>
                          {year}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <label className="text-sm font-medium text-slate-700 mb-2 block">Month</label>
                  <Select value={selectedMonth} onValueChange={setSelectedMonth}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select month" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Months</SelectItem>
                      {monthNames.map((month, index) => (
                        <SelectItem key={index + 1} value={(index + 1).toString()}>
                          {month}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <label className="text-sm font-medium text-slate-700 mb-2 block">Category</label>
                  <Select value={selectedCategory} onValueChange={setSelectedCategory}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select category" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Categories</SelectItem>
                      {categories?.map(category => (
                        <SelectItem key={category} value={category}>
                          {category}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <label className="text-sm font-medium text-slate-700 mb-2 block">Agent</label>
                  <Select value={selectedAgent} onValueChange={setSelectedAgent}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select agent" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Agents</SelectItem>
                      {Array.isArray(agents) && agents.map(agent => (
                        <SelectItem key={agent.id} value={agent.id}>
                          {agent.username}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

              </div>

              {/* Loading Indicator */}
              {loadingPerformance && (
                <div className="flex items-center justify-center py-4">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
                  <span className="ml-2 text-sm text-slate-600">Loading data...</span>
                </div>
              )}

              {/* Performance Data Table */}
              {performanceData.length > 0 && (
                <>
                  <div className="w-full overflow-auto mt-4 rounded-md border">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="sticky left-0 bg-white z-10">Agent</TableHead>
                          <TableHead className="text-center">Rate %</TableHead>
                          <TableHead className="text-center">&lt; 1hr</TableHead>
                          <TableHead className="text-center">1-2hr</TableHead>
                          <TableHead className="text-center">2-3hr</TableHead>
                          <TableHead className="text-center">&gt; 3hr</TableHead>
                          <TableHead className="text-center">Pending</TableHead>
                          <TableHead className="text-center">In Progress</TableHead>
                          <TableHead className="text-center">Completed</TableHead>
                          <TableHead className="text-center">Total</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {performanceData.map((row, index) => (
                          <TableRow key={index}>
                            <TableCell className="font-medium sticky left-0 bg-white z-10">{row.agent}</TableCell>
                            <TableCell className="text-center">{row.completion_rate}%</TableCell>
                            <TableCell className="text-center">{row.under_1hr || ''}</TableCell>
                            <TableCell className="text-center">{row.between_1_2hr || ''}</TableCell>
                            <TableCell className="text-center">{row.between_2_3hr || ''}</TableCell>
                            <TableCell className="text-center">{row.over_3hr || ''}</TableCell>
                            <TableCell className="text-center">{row.pending || ''}</TableCell>
                            <TableCell className="text-center">{row.in_progress || ''}</TableCell>
                            <TableCell className="text-center">{row.completed || ''}</TableCell>
                            <TableCell className="text-center">{row.total}</TableCell>
                          </TableRow>
                        ))}
                        {performanceSummary && (
                          <TableRow className="bg-slate-50 font-bold border-t-2 border-slate-300">
                            <TableCell className="font-bold text-slate-900 sticky left-0 bg-slate-50 z-10">SUMMARY</TableCell>
                            <TableCell className="text-center">{performanceSummary.completion_rate}%</TableCell>
                            <TableCell className="text-center">{performanceSummary.under_1hr}</TableCell>
                            <TableCell className="text-center">{performanceSummary.between_1_2hr}</TableCell>
                            <TableCell className="text-center">{performanceSummary.between_2_3hr}</TableCell>
                            <TableCell className="text-center">{performanceSummary.over_3hr}</TableCell>
                            <TableCell className="text-center">{performanceSummary.pending}</TableCell>
                            <TableCell className="text-center">{performanceSummary.in_progress}</TableCell>
                            <TableCell className="text-center">{performanceSummary.completed}</TableCell>
                            <TableCell className="text-center">{performanceSummary.total}</TableCell>
                          </TableRow>
                        )}
                      </TableBody>
                    </Table>
                  </div>

                  {/* Export Buttons */}
                  <div className="flex gap-2 mt-4">
                    {/* CSV Export removed as per request */}
                    <Button
                      onClick={() => exportPerformanceReport('xlsx')}
                    >
                      <FileSpreadsheet className="w-4 h-4 mr-2" />
                      Export XLSX
                    </Button>
                  </div>
                </>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Performance by Agent Table */}
      <div className="mt-8 max-w-full">
        <Card className="overflow-hidden">
          <CardHeader>
            <CardTitle>Performance by Agent (HD ROC)</CardTitle>
            <p className="text-sm text-slate-500">Jumlah permintaan berdasarkan agen dan tipe</p>
          </CardHeader>
          <CardContent className="overflow-hidden">
            {loadingByAgent ? (
              <div className="space-y-4 p-4">
                <Skeleton className="h-10 w-full" />
                <Skeleton className="h-10 w-full" />
                <Skeleton className="h-10 w-full" />
                <Skeleton className="h-10 w-full" />
              </div>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="font-bold">HD ROC</TableHead>
                      <TableHead className="text-center font-bold">INTEGRASI</TableHead>
                      <TableHead className="text-center font-bold">PUSH BIMA</TableHead>
                      <TableHead className="text-center font-bold">RECONFIG</TableHead>
                      <TableHead className="text-center font-bold">REPLACE ONT</TableHead>
                      <TableHead className="text-center font-bold">TROUBLESHOOT</TableHead>
                      <TableHead className="text-center font-bold">Grand Total</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {performanceByAgent.data.map((row, index) => (
                      <TableRow key={index}>
                        <TableCell className="font-medium">{row.agent}</TableCell>
                        <TableCell className="text-center">{row.INTEGRASI || ''}</TableCell>
                        <TableCell className="text-center">{row['PUSH BIMA'] || ''}</TableCell>
                        <TableCell className="text-center">{row.RECONFIG || ''}</TableCell>
                        <TableCell className="text-center">{row['REPLACE ONT'] || ''}</TableCell>
                        <TableCell className="text-center">{row.TROUBLESHOOT || ''}</TableCell>
                        <TableCell className="text-center font-bold">{row.total}</TableCell>
                      </TableRow>
                    ))}
                    {performanceByAgent.grand_total && (
                      <TableRow className="bg-slate-100 font-bold border-t-2 border-slate-300">
                        <TableCell className="font-bold">Grand Total</TableCell>
                        <TableCell className="text-center">{performanceByAgent.grand_total.INTEGRASI}</TableCell>
                        <TableCell className="text-center">{performanceByAgent.grand_total['PUSH BIMA']}</TableCell>
                        <TableCell className="text-center">{performanceByAgent.grand_total.RECONFIG}</TableCell>
                        <TableCell className="text-center">{performanceByAgent.grand_total['REPLACE ONT']}</TableCell>
                        <TableCell className="text-center">{performanceByAgent.grand_total.TROUBLESHOOT}</TableCell>
                        <TableCell className="text-center">{performanceByAgent.grand_total.total}</TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Performance by Product Table */}
      <div className="mt-8 max-w-full mb-8">
        <Card className="overflow-hidden">
          <CardHeader>
            <CardTitle>Performance by Product</CardTitle>
            <p className="text-sm text-slate-500">Jumlah permintaan berdasarkan produk/kategori dan tipe</p>
          </CardHeader>
          <CardContent className="overflow-hidden">
            {loadingByProduct ? (
              <div className="space-y-4 p-4">
                <Skeleton className="h-10 w-full" />
                <Skeleton className="h-10 w-full" />
                <Skeleton className="h-10 w-full" />
                <Skeleton className="h-10 w-full" />
              </div>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead rowSpan={2} className="font-bold">PRODUCT</TableHead>
                      <TableHead rowSpan={2} className="text-center font-bold">INTEGRASI</TableHead>
                      <TableHead rowSpan={2} className="text-center font-bold">PUSH BIMA</TableHead>
                      <TableHead rowSpan={2} className="text-center font-bold">RECONFIG</TableHead>
                      <TableHead rowSpan={2} className="text-center font-bold">REPLACE ONT</TableHead>
                      <TableHead rowSpan={2} className="text-center font-bold">TROUBLESHOOT</TableHead>
                      <TableHead colSpan={3} className="text-center font-bold border-b">QC2</TableHead>
                      <TableHead rowSpan={2} className="text-center font-bold">LEPAS BI</TableHead>
                    </TableRow>
                    <TableRow>
                      <TableHead className="text-center text-xs">HSI</TableHead>
                      <TableHead className="text-center text-xs">WIFI</TableHead>
                      <TableHead className="text-center text-xs">DATIN</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {Array.isArray(performanceByProduct.data) && performanceByProduct.data.length > 0 ? (
                      <>
                        {performanceByProduct.data.map((row, index) => {
                          const productUpper = (row.product || '').toUpperCase();
                          const isQC2 = productUpper.includes('QC2');
                          const isQC2HSI = isQC2 && productUpper.includes('HSI');
                          const isQC2WIFI = isQC2 && productUpper.includes('WIFI');
                          const isQC2DATIN = isQC2 && productUpper.includes('DATIN');
                          const isLepasBI = productUpper.includes('LEPAS');
                          const rowTotal = (row.INTEGRASI || 0) + (row['PUSH BIMA'] || 0) + (row.RECONFIG || 0) + (row['REPLACE ONT'] || 0) + (row.TROUBLESHOOT || 0);

                          // Simplify product name: "QC2 - HSI" -> "QC2"
                          let displayProduct = row.product;
                          if (isQC2) {
                            displayProduct = 'QC2';
                          }

                          return (
                            <TableRow key={index}>
                              <TableCell className="font-medium">{displayProduct}</TableCell>
                              <TableCell className="text-center">{row.INTEGRASI || ''}</TableCell>
                              <TableCell className="text-center">{row['PUSH BIMA'] || ''}</TableCell>
                              <TableCell className="text-center">{row.RECONFIG || ''}</TableCell>
                              <TableCell className="text-center">{row['REPLACE ONT'] || ''}</TableCell>
                              <TableCell className="text-center">{row.TROUBLESHOOT || ''}</TableCell>
                              <TableCell className="text-center">{isQC2HSI ? rowTotal : ''}</TableCell>
                              <TableCell className="text-center">{isQC2WIFI ? rowTotal : ''}</TableCell>
                              <TableCell className="text-center">{isQC2DATIN ? rowTotal : ''}</TableCell>
                              <TableCell className="text-center">{isLepasBI ? rowTotal : ''}</TableCell>
                            </TableRow>
                          );
                        })}
                        {performanceByProduct.grand_total && (
                          <TableRow className="bg-slate-100 font-bold border-t-2 border-slate-300">
                            <TableCell className="font-bold">Grand Total</TableCell>
                            <TableCell className="text-center">{performanceByProduct.grand_total.INTEGRASI}</TableCell>
                            <TableCell className="text-center">{performanceByProduct.grand_total['PUSH BIMA']}</TableCell>
                            <TableCell className="text-center">{performanceByProduct.grand_total.RECONFIG}</TableCell>
                            <TableCell className="text-center">{performanceByProduct.grand_total['REPLACE ONT']}</TableCell>
                            <TableCell className="text-center">{performanceByProduct.grand_total.TROUBLESHOOT}</TableCell>
                            <TableCell className="text-center">{performanceByProduct.pivoted_total?.qc2_hsi || 0}</TableCell>
                            <TableCell className="text-center">{performanceByProduct.pivoted_total?.qc2_wifi || 0}</TableCell>
                            <TableCell className="text-center">{performanceByProduct.pivoted_total?.qc2_datin || 0}</TableCell>
                            <TableCell className="text-center">{performanceByProduct.pivoted_total?.lepas_bi || 0}</TableCell>
                          </TableRow>
                        )}
                      </>
                    ) : (
                      <TableRow>
                        <TableCell colSpan={10} className="text-center py-4 text-slate-500">
                          No performance data available
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
