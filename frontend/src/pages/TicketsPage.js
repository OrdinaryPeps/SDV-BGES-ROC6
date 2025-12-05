import { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import { API } from '../App';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Badge } from '../components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../components/ui/tabs';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { Clock, User, Tag, MessageCircle, Filter, Search, X } from 'lucide-react';
import { format } from 'date-fns';
import { Switch } from '../components/ui/switch';
import { Label } from '../components/ui/label';
import { Input } from '../components/ui/input';

export default function TicketsPage({ user }) {
  const [tickets, setTickets] = useState([]);
  const [openTickets, setOpenTickets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState(user.role === 'agent' ? 'in_progress' : 'all');
  const [todayOnly, setTodayOnly] = useState(false);
  const [unreadTickets, setUnreadTickets] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const navigate = useNavigate();
  const wsRef = useRef(null);

  // Request browser notification permission on load
  useEffect(() => {
    if ('Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission();
    }
  }, []);

  useEffect(() => {
    fetchTickets();
    if (user.role === 'agent') {
      fetchOpenTickets();
      fetchUnreadReplies();
    }
  }, [activeTab, todayOnly]);

  // WebSocket connection for real-time notifications
  useEffect(() => {
    const token = localStorage.getItem('token');
    let wsBaseUrl = API;
    if (wsBaseUrl.startsWith('/')) {
      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      wsBaseUrl = `${protocol}//${window.location.host}${wsBaseUrl}`;
    }
    const wsUrl = wsBaseUrl.replace('http', 'ws').replace('/api', '/api/notifications/ws');
    const ws = new WebSocket(`${wsUrl}?token=${token}`);

    ws.onopen = () => {
      // Send ping every 30s to keep connection alive
      setInterval(() => {
        if (ws.readyState === WebSocket.OPEN) {
          ws.send('ping');
        }
      }, 30000);
    };

    ws.onmessage = (event) => {
      if (event.data === 'pong') return;

      try {
        const data = JSON.parse(event.data);

        if (data.type === 'new_ticket') {
          toast.success('🎫 Tiket baru tersedia!');
          fetchOpenTickets();

          // Browser notification
          if (Notification.permission === 'granted') {
            new Notification('Tiket Baru', {
              body: 'Ada tiket baru yang tersedia untuk diambil',
              icon: '/favicon.ico'
            });
          }
        } else if (data.type === 'new_reply') {
          toast.info(`💬 Balasan baru dari ${data.data.user_name} pada tiket ${data.data.ticket_number}`);
          fetchUnreadReplies();
          fetchTickets(); // Refresh current tab to show updated data

          // Browser notification
          if (Notification.permission === 'granted') {
            new Notification('Balasan Baru', {
              body: `${data.data.user_name} membalas tiket ${data.data.ticket_number}`,
              icon: '/favicon.ico'
            });
          }
        }
      } catch (error) {
        console.error('WebSocket message error:', error);
      }
    };

    ws.onerror = (error) => {
      console.error('WebSocket error:', error);
    };

    ws.onclose = () => {
    };

    wsRef.current = ws;

    return () => {
      if (wsRef.current) {
        wsRef.current.close();
      }
    };
  }, []);

  const fetchTickets = async () => {
    try {
      const status = activeTab === 'all' ? '' : activeTab;
      const params = {};
      if (status) params.status = status;
      if (todayOnly) {
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        params.start_date = today.toISOString();
      }

      const token = localStorage.getItem('token');
      const response = await axios.get(`${API}/tickets/`, {
        params,
        headers: { Authorization: `Bearer ${token}` }
      });
      setTickets(response.data);
    } catch (error) {
      console.error('Fetch tickets error:', error);
      toast.error('Failed to fetch tickets');
    } finally {
      setLoading(false);
    }
  };

  const fetchUnreadReplies = async () => {
    try {
      const response = await axios.get(`${API}/tickets/unread-replies`);
      setUnreadTickets(response.data.ticket_ids || []);
    } catch (error) {
      console.error('Failed to fetch unread replies');
    }
  };

  const handleTicketClick = async (ticketId) => {
    // Mark ticket as read
    if (user.role === 'agent' && unreadTickets.includes(ticketId)) {
      try {
        await axios.put(`${API}/tickets/${ticketId}/mark-read`);
        setUnreadTickets(prev => prev.filter(id => id !== ticketId));
      } catch (error) {
        console.error('Failed to mark as read');
      }
    }
    navigate(`/tickets/${ticketId}`);
  };

  const fetchOpenTickets = async () => {
    try {
      // Get all open tickets (not assigned yet) for agent to claim
      const response = await axios.get(`${API}/tickets/open/available`);
      setOpenTickets(response.data);
    } catch (error) {
      console.error('Failed to fetch open tickets');
    }
  };

  const handleClaimTicket = async (ticketId) => {
    try {
      await axios.put(`${API}/tickets/${ticketId}`, {
        assigned_agent: user.id,
        assigned_agent_name: user.full_name || user.username,
        status: 'in_progress'
      });
      toast.success('Ticket claimed successfully!');
      fetchTickets();
      if (user.role === 'agent') {
        fetchOpenTickets();
      }
    } catch (error) {
      if (error.response?.status === 409) {
        toast.error(error.response.data.detail || 'Ticket sudah diambil oleh agent lain. Silakan pilih ticket lain.');
        // Refresh list to remove the claimed ticket
        fetchOpenTickets();
      } else {
        toast.error('Failed to claim ticket');
      }
    }
  };

  const getStatusBadge = (status) => {
    const variants = {
      open: 'bg-orange-100 text-orange-700',
      pending: 'bg-yellow-100 text-yellow-700',
      in_progress: 'bg-blue-100 text-blue-700',
      completed: 'bg-green-100 text-green-700'
    };
    return variants[status] || 'bg-slate-100 text-slate-700';
  };

  // Filter tickets by search query
  const filterTickets = (ticketList) => {
    if (!searchQuery.trim()) return ticketList;

    const query = searchQuery.toLowerCase().trim();
    return ticketList.filter(ticket =>
      ticket.ticket_number?.toLowerCase().includes(query) ||
      ticket.description?.toLowerCase().includes(query) ||
      ticket.category?.toLowerCase().includes(query) ||
      ticket.permintaan?.toLowerCase().includes(query) ||
      ticket.user_telegram_name?.toLowerCase().includes(query) ||
      ticket.assigned_agent_name?.toLowerCase().includes(query) ||
      ticket.wonum?.toLowerCase().includes(query) ||
      ticket.nd_internet_voice?.toLowerCase().includes(query)
    );
  };

  const filteredTickets = filterTickets(tickets);

  if (loading) {
    return <div className="text-center py-12">Loading...</div>;
  }


  return (
    <div className="space-y-6" data-testid="tickets-page">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-slate-900">Tickets</h1>
          <p className="text-slate-500 mt-1">
            {user.role === 'agent' ? 'Tiket yang ditugaskan kepada Anda dan tiket yang tersedia untuk diambil' : 'Kelola dan pantau semua tiket'}
          </p>
        </div>

        {/* Search and Filter Row */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
          {/* Search Box */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-slate-400" />
            <Input
              type="text"
              placeholder="Cari tiket..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9 pr-9 w-full sm:w-64"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-3 top-1/2 transform -translate-y-1/2 text-slate-400 hover:text-slate-600"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>

          {/* Today Filter Toggle */}
          <div className="flex items-center space-x-2">
            <Switch
              id="today-filter"
              checked={todayOnly}
              onCheckedChange={setTodayOnly}
            />
            <Label htmlFor="today-filter" className="flex items-center gap-2 cursor-pointer">
              <Filter className="w-4 h-4" />
              Hari Ini Saja
            </Label>
          </div>
        </div>
      </div>

      {/* Search Results Count */}
      {searchQuery && (
        <div className="text-sm text-slate-600">
          Ditemukan <span className="font-semibold">{filteredTickets.length}</span> tiket untuk "{searchQuery}"
        </div>
      )}

      {/* Available Tickets for Agent to Claim */}
      {user.role === 'agent' && openTickets.length > 0 && (
        <Card className="border-blue-200 bg-blue-50">
          <CardHeader>
            <CardTitle className="text-blue-900">Available Tickets to Claim</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid gap-3">
              {openTickets.map((ticket) => (
                <div
                  key={ticket.id}
                  className="flex flex-col md:flex-row md:items-center justify-between bg-white p-4 rounded-lg border border-blue-200 gap-4"
                  data-testid={`available-ticket-${ticket.ticket_number}`}
                >
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <h4 className="font-semibold text-slate-900">{ticket.ticket_number}</h4>
                    </div>
                    <p className="text-sm text-slate-600 line-clamp-2">{ticket.description}</p>
                    <div className="flex flex-wrap items-center gap-3 text-xs text-slate-500 mt-2">
                      <span className="inline-flex items-center gap-1 px-2 py-1 bg-blue-100 text-blue-700 rounded-md font-medium">
                        <Tag className="w-3 h-3" />
                        {ticket.category}
                        {ticket.permintaan && (
                          <span className="text-blue-600"> - {ticket.permintaan}</span>
                        )}
                      </span>
                      <span className="flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        {format(new Date(ticket.created_at), 'MMM dd, yyyy')}
                      </span>
                    </div>
                  </div>
                  <Button
                    onClick={() => handleClaimTicket(ticket.id)}
                    className="w-full md:w-auto"
                    data-testid={`claim-ticket-${ticket.ticket_number}`}
                  >
                    Claim Ticket
                  </Button>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="flex flex-wrap h-auto p-1 gap-1">
          {user.role === 'agent' ? (
            <>
              <TabsTrigger value="in_progress" data-testid="tab-in-progress" className="flex-1">
                In Progress
                {unreadTickets.filter(id => tickets.find(t => t.id === id && t.status === 'in_progress')).length > 0 && (
                  <Badge variant="destructive" className="ml-2">
                    {unreadTickets.filter(id => tickets.find(t => t.id === id && t.status === 'in_progress')).length}
                  </Badge>
                )}
              </TabsTrigger>
              <TabsTrigger value="pending" data-testid="tab-pending" className="flex-1">
                Pending
                {unreadTickets.filter(id => tickets.find(t => t.id === id && t.status === 'pending')).length > 0 && (
                  <Badge variant="destructive" className="ml-2">
                    {unreadTickets.filter(id => tickets.find(t => t.id === id && t.status === 'pending')).length}
                  </Badge>
                )}
              </TabsTrigger>
              <TabsTrigger value="completed" data-testid="tab-completed" className="flex-1">
                Completed
              </TabsTrigger>
            </>
          ) : (
            <>
              <TabsTrigger value="all" data-testid="tab-all" className="flex-1">All</TabsTrigger>
              <TabsTrigger value="open" data-testid="tab-open" className="flex-1">Open</TabsTrigger>
              <TabsTrigger value="pending" data-testid="tab-pending" className="flex-1">Pending</TabsTrigger>
              <TabsTrigger value="in_progress" data-testid="tab-in-progress" className="flex-1">In Progress</TabsTrigger>
              <TabsTrigger value="completed" data-testid="tab-completed" className="flex-1">Completed</TabsTrigger>
            </>
          )}
        </TabsList>

        <TabsContent value={activeTab} className="mt-6">
          {filteredTickets.length === 0 ? (
            <Card>
              <CardContent className="py-12">
                <p className="text-center text-slate-500">
                  {searchQuery ? `Tidak ada tiket yang cocok dengan "${searchQuery}"` : 'No tickets found'}
                </p>
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-4">
              {filteredTickets.map((ticket) => (
                <Card
                  key={ticket.id}
                  className="hover:shadow-lg transition-shadow cursor-pointer relative"
                  onClick={() => handleTicketClick(ticket.id)}
                  data-testid={`ticket-card-${ticket.ticket_number}`}
                >
                  <CardContent className="pt-6">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-3 mb-2">
                          <h3 className="text-lg font-semibold text-slate-900">
                            {ticket.ticket_number}
                          </h3>
                          <Badge className={getStatusBadge(ticket.status)}>
                            {ticket.status.replace('_', ' ')}
                          </Badge>
                          {/* Unread Badge */}
                          {user.role === 'agent' && unreadTickets.includes(ticket.id) && (
                            <Badge variant="destructive" className="flex items-center gap-1">
                              <MessageCircle className="w-3 h-3" />
                              Balasan Baru
                            </Badge>
                          )}
                        </div>
                        <p className="text-slate-600 mb-3 line-clamp-2">{ticket.description}</p>
                        <div className="flex items-center gap-4 text-sm text-slate-500">
                          <span className="inline-flex items-center gap-1 px-2 py-1 bg-blue-100 text-blue-700 rounded-md font-medium">
                            <Tag className="w-4 h-4" />
                            {ticket.category}
                            {ticket.permintaan && (
                              <span className="text-blue-600"> - {ticket.permintaan}</span>
                            )}
                          </span>
                          {ticket.assigned_agent_name && (
                            <div className="flex items-center gap-1">
                              <User className="w-4 h-4" />
                              <span>{ticket.assigned_agent_name}</span>
                            </div>
                          )}
                          <div className="flex items-center gap-1">
                            <Clock className="w-4 h-4" />
                            <span>{format(new Date(ticket.created_at), 'MMM dd, yyyy')}</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
