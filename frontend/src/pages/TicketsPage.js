import { useState, useEffect } from 'react';
import axios from 'axios';
import { API } from '../App';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Badge } from '../components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../components/ui/tabs';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { Clock, User, Tag } from 'lucide-react';
import { format } from 'date-fns';

export default function TicketsPage({ user }) {
  const [tickets, setTickets] = useState([]);
  const [openTickets, setOpenTickets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('all');
  const navigate = useNavigate();

  useEffect(() => {
    fetchTickets();
    if (user.role === 'agent') {
      fetchOpenTickets();
    }
  }, [activeTab]);

  const fetchTickets = async () => {
    try {
      const status = activeTab === 'all' ? '' : activeTab;
      const response = await axios.get(`${API}/tickets`, {
        params: status ? { status } : {}
      });
      setTickets(response.data);
    } catch (error) {
      toast.error('Failed to fetch tickets');
    } finally {
      setLoading(false);
    }
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

  if (loading) {
    return <div className="text-center py-12">Loading...</div>;
  }

  return (
    <div className="space-y-6" data-testid="tickets-page">
      <div>
        <h1 className="text-3xl font-bold text-slate-900">Tickets</h1>
        <p className="text-slate-500 mt-1">
          {user.role === 'agent' ? 'Tiket yang ditugaskan kepada Anda dan tiket yang tersedia untuk diambil' : 'Manage and track all tickets'}
        </p>
      </div>

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
          <TabsTrigger value="all" data-testid="tab-all" className="flex-1">
            {user.role === 'agent' ? 'My Tickets' : 'All'}
          </TabsTrigger>
          {user.role !== 'agent' && (
            <TabsTrigger value="open" data-testid="tab-open" className="flex-1">Open</TabsTrigger>
          )}
          <TabsTrigger value="pending" data-testid="tab-pending" className="flex-1">Pending</TabsTrigger>
          <TabsTrigger value="in_progress" data-testid="tab-in-progress" className="flex-1">In Progress</TabsTrigger>
          <TabsTrigger value="completed" data-testid="tab-completed" className="flex-1">Completed</TabsTrigger>
        </TabsList>

        <TabsContent value={activeTab} className="mt-6">
          {tickets.length === 0 ? (
            <Card>
              <CardContent className="py-12">
                <p className="text-center text-slate-500">No tickets found</p>
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-4">
              {tickets.map((ticket) => (
                <Card
                  key={ticket.id}
                  className="hover:shadow-lg transition-shadow cursor-pointer"
                  onClick={() => navigate(`/tickets/${ticket.id}`)}
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
