# 🎯 Auto-Assignment Ticket System - Implementation Plan

## Executive Summary

Sistem tiket akan berubah dari manual "Pick Up" menjadi **Auto-Assignment** dengan fitur:
- Random/Round-Robin assignment ke agent online
- Limit maksimal 5 tiket per agent
- Serial queue system (FIFO)
- Auto-refill saat agent menyelesaikan tiket

---

## 📋 Requirements

### Functional Requirements
| ID | Requirement |
|----|-------------|
| FR-01 | Agent dapat set status Online/Offline |
| FR-02 | Tiket baru auto-assign ke agent online dengan slot tersedia |
| FR-03 | Maksimal 5 tiket aktif per agent |
| FR-04 | Saat tiket selesai, tiket baru otomatis masuk ke antrian paling bawah |
| FR-05 | Admin dapat melihat workload semua agent |
| FR-06 | Admin dapat manual reassign jika diperlukan |

### Non-Functional Requirements
| ID | Requirement |
|----|-------------|
| NFR-01 | Assignment harus real-time (< 2 detik) |
| NFR-02 | Notifikasi ke agent via Telegram & Web |
| NFR-03 | Sistem harus handle concurrent requests |

---

## 🏗️ Architecture

### System Flow Diagram

```
┌─────────────────────────────────────────────────────────────────┐
│                         USER (Telegram)                          │
└───────────────────────────────┬─────────────────────────────────┘
                                │ Create Ticket
                                ▼
┌─────────────────────────────────────────────────────────────────┐
│                         TICKET QUEUE                             │
│  ┌────────┐ ┌────────┐ ┌────────┐ ┌────────┐                    │
│  │Ticket 1│→│Ticket 2│→│Ticket 3│→│Ticket 4│→ ...               │
│  └────────┘ └────────┘ └────────┘ └────────┘                    │
└───────────────────────────────┬─────────────────────────────────┘
                                │
                                ▼
┌─────────────────────────────────────────────────────────────────┐
│                    AUTO-ASSIGNMENT ENGINE                        │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │ 1. Get eligible agents (online + slots available)        │   │
│  │ 2. Select agent (Round Robin / Random)                   │   │
│  │ 3. Assign ticket to agent's queue                        │   │
│  │ 4. Send notifications (Telegram + WebSocket)             │   │
│  └──────────────────────────────────────────────────────────┘   │
└───────────────────────────────┬─────────────────────────────────┘
                                │
        ┌───────────────────────┼───────────────────────┐
        ▼                       ▼                       ▼
┌───────────────┐       ┌───────────────┐       ┌───────────────┐
│   Agent 1     │       │   Agent 2     │       │   Agent 3     │
│   🟢 Online   │       │   🟢 Online   │       │   🔴 Offline  │
│   [3/5] ███▒▒ │       │   [5/5] █████ │       │   [0/5] ▒▒▒▒▒ │
│   ✓ Eligible  │       │   ✗ Full      │       │   ✗ Offline   │
├───────────────┤       ├───────────────┤       ├───────────────┤
│ Queue:        │       │ Queue:        │       │ Queue:        │
│ 1. INC...     │       │ 1. INC...     │       │ (empty)       │
│ 2. INC...     │       │ 2. INC...     │       │               │
│ 3. INC...     │       │ 3. INC...     │       │               │
│               │       │ 4. INC...     │       │               │
│               │       │ 5. INC...     │       │               │
└───────────────┘       └───────────────┘       └───────────────┘
```

### Ticket Lifecycle

```
┌──────────┐     ┌──────────┐     ┌──────────┐     ┌──────────┐
│  QUEUED  │────▶│ ASSIGNED │────▶│IN_PROGRESS────▶│ COMPLETED│
└──────────┘     └──────────┘     └──────────┘     └──────────┘
     │                │                                  │
     │                │                                  │
     │                ▼                                  ▼
     │         ┌──────────┐                    ┌──────────────┐
     │         │ PENDING  │                    │ TRIGGER      │
     │         └──────────┘                    │ AUTO-ASSIGN  │
     │                                         │ NEW TICKET   │
     │                                         └──────────────┘
     │
     └─── No agent available → stays in queue
```

---

## 💾 Database Schema

### Collection: `agent_status`

```javascript
{
  _id: ObjectId,
  agent_id: "uuid",              // Reference to users collection
  agent_name: "agent1",
  
  // Online Status
  is_online: true,
  last_online: ISODate(),
  last_activity: ISODate(),
  
  // Queue Management
  current_tickets: 3,            // Count of active tickets
  max_tickets: 5,                // Configurable limit
  
  // Round Robin
  assignment_order: 1,           // For round-robin assignment
  last_assigned: ISODate(),      // Last time received a ticket
  
  // Statistics
  total_assigned_today: 10,
  total_completed_today: 7
}

// Indexes
{ agent_id: 1 }  // unique
{ is_online: 1, current_tickets: 1 }  // for querying eligible agents
```

### Collection: `ticket_queue`

```javascript
{
  _id: ObjectId,
  ticket_id: "uuid",             // Reference to tickets collection
  ticket_number: "INC...",
  
  // Queue Status
  status: "queued",              // queued | assigned | completed
  position: 1,                   // Global queue position
  
  // Assignment
  assigned_agent: null,          // null if queued
  assigned_at: null,
  
  // Agent Queue Position
  agent_queue_position: null,    // Position in agent's personal queue
  
  // Timestamps
  queued_at: ISODate(),
  created_at: ISODate()
}

// Indexes
{ status: 1, position: 1 }
{ assigned_agent: 1, status: 1 }
{ ticket_id: 1 }  // unique
```

### Updated: `users` Collection

```javascript
// Add new fields to existing users collection
{
  // ... existing fields
  
  // New fields for agents
  is_online: false,
  last_online: ISODate(),
  max_tickets: 5,                // Admin configurable per agent
  auto_assignment_enabled: true  // Can be disabled for specific agents
}
```

---

## 🔧 Backend Implementation

### New Files Structure

```
backend/app/
├── services/
│   ├── auto_assignment.py      # Core assignment logic
│   ├── agent_status.py         # Online/offline management
│   └── ticket_queue.py         # Queue management
├── routers/
│   ├── agent_status.py         # API endpoints for status
│   └── queue.py                # Queue management endpoints
└── models/
    ├── agent_status.py         # Pydantic models
    └── ticket_queue.py
```

### Core Service: `auto_assignment.py`

```python
class AutoAssignmentService:
    
    async def assign_new_ticket(self, ticket_id: str) -> Optional[str]:
        """
        Assign a new ticket to an eligible agent.
        Returns agent_id if assigned, None if no agent available.
        """
        # 1. Get eligible agents
        eligible_agents = await self.get_eligible_agents()
        
        if not eligible_agents:
            # No agents available, ticket stays in queue
            await self.add_to_queue(ticket_id)
            return None
        
        # 2. Select agent (Round Robin)
        selected_agent = await self.select_next_agent(eligible_agents)
        
        # 3. Assign ticket
        await self.assign_ticket_to_agent(ticket_id, selected_agent.agent_id)
        
        # 4. Update agent stats
        await self.increment_agent_tickets(selected_agent.agent_id)
        
        # 5. Send notifications
        await self.notify_agent_new_ticket(selected_agent, ticket_id)
        
        return selected_agent.agent_id
    
    async def get_eligible_agents(self) -> List[AgentStatus]:
        """Get agents that are online and have available slots."""
        return await db.agent_status.find({
            "is_online": True,
            "$expr": {"$lt": ["$current_tickets", "$max_tickets"]}
        }).to_list(100)
    
    async def select_next_agent(self, agents: List[AgentStatus]) -> AgentStatus:
        """Round Robin selection - agent with lowest assignment_order."""
        return min(agents, key=lambda a: (a.last_assigned, a.assignment_order))
    
    async def on_ticket_completed(self, ticket_id: str, agent_id: str):
        """Called when agent completes a ticket."""
        # 1. Decrement agent's ticket count
        await self.decrement_agent_tickets(agent_id)
        
        # 2. Check queue for pending tickets
        next_ticket = await self.get_next_queued_ticket()
        
        if next_ticket:
            # 3. Assign to the same agent (at bottom of their queue)
            await self.assign_ticket_to_agent(
                next_ticket.ticket_id, 
                agent_id,
                position="bottom"
            )
            
            # 4. Notify agent
            await self.notify_agent_new_ticket(agent_id, next_ticket.ticket_id)
```

### API Endpoints

#### Agent Status Router

```python
@router.post("/go-online")
async def agent_go_online(current_user: User = Depends(get_current_user)):
    """Set agent status to online and process queue."""
    await agent_status_service.set_online(current_user.id)
    
    # Check if there are pending tickets to assign
    await auto_assignment_service.process_queue_for_agent(current_user.id)
    
    return {"status": "online", "message": "You are now online"}

@router.post("/go-offline")
async def agent_go_offline(current_user: User = Depends(get_current_user)):
    """Set agent status to offline."""
    await agent_status_service.set_offline(current_user.id)
    return {"status": "offline", "message": "You are now offline"}

@router.get("/my-queue")
async def get_my_queue(current_user: User = Depends(get_current_user)):
    """Get agent's current ticket queue."""
    queue = await ticket_queue_service.get_agent_queue(current_user.id)
    return {"queue": queue, "count": len(queue), "max": 5}

@router.get("/workload")  # Admin only
async def get_all_agents_workload(current_user: User = Depends(get_current_user)):
    """Get workload of all agents."""
    if current_user.role != "admin":
        raise HTTPException(403, "Admin only")
    return await agent_status_service.get_all_workload()
```

---

## 🎨 Frontend Implementation

### New Components

```
frontend/src/
├── components/
│   ├── AgentStatusToggle.js     # Online/Offline toggle button
│   ├── AgentQueue.js            # Personal queue display
│   ├── WorkloadDashboard.js     # Admin workload view
│   └── QueuePositionBadge.js    # Show queue position
├── pages/
│   └── AgentDashboard.js        # Updated with queue view
└── hooks/
    └── useAgentStatus.js        # Status management hook
```

### Agent Dashboard UI Mockup

```
┌─────────────────────────────────────────────────────────────┐
│  🟢 Online                              [Go Offline]        │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  📋 My Ticket Queue (3/5)                                   │
│  ─────────────────────────────────────────────────────────  │
│                                                             │
│  ┌─────────────────────────────────────────────────────┐   │
│  │ #1 • INC120420251352536CO                           │   │
│  │     HSI INDIBIZ - TROUBLESHOOT                      │   │
│  │     Status: 🔵 In Progress                          │   │
│  │     Assigned: 10 menit yang lalu                    │   │
│  │     [Open] [Mark Complete]                          │   │
│  └─────────────────────────────────────────────────────┘   │
│                                                             │
│  ┌─────────────────────────────────────────────────────┐   │
│  │ #2 • INC120420251353295LM                           │   │
│  │     WMSLite - PUSH BIMA                             │   │
│  │     Status: 🟡 Pending                              │   │
│  │     Assigned: 5 menit yang lalu                     │   │
│  │     [Open] [Mark Complete]                          │   │
│  └─────────────────────────────────────────────────────┘   │
│                                                             │
│  ┌─────────────────────────────────────────────────────┐   │
│  │ #3 • INC120420251353425NL                           │   │
│  │     BITSTREAM - RECONFIG                            │   │
│  │     Status: 🟡 Pending                              │   │
│  │     Assigned: 2 menit yang lalu                     │   │
│  │     [Open] [Mark Complete]                          │   │
│  └─────────────────────────────────────────────────────┘   │
│                                                             │
│  ─────────────────────────────────────────────────────────  │
│  ℹ️  2 slots available. New tickets will be auto-assigned. │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

### Admin Workload Dashboard

```
┌─────────────────────────────────────────────────────────────┐
│  👥 Agent Workload                                          │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  Agent        Status    Queue      Progress                 │
│  ───────────────────────────────────────────────────────    │
│  agent1       🟢 Online  4/5       ████████▒▒  80%          │
│  agent2       🟢 Online  5/5       ██████████  100% FULL    │
│  agent3       🔴 Offline 2/5       ████▒▒▒▒▒▒  40%          │
│  agent4       🟢 Online  0/5       ▒▒▒▒▒▒▒▒▒▒  0%           │
│                                                             │
├─────────────────────────────────────────────────────────────┤
│  📊 Queue Statistics                                        │
│  ───────────────────────────────────────────────────────    │
│  Pending in Queue: 3 tickets                                │
│  Online Agents: 3/4                                         │
│  Total Capacity: 7 slots available                          │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

---

## 📱 Telegram Bot Updates

### New Commands

```javascript
// Agent commands
/online   - Set status online
/offline  - Set status offline
/myqueue  - View current ticket queue
/status   - Check online status and queue

// Notifications
"🎫 Tiket baru ditambahkan ke antrian Anda!
Ticket: INC120420251352536CO
Kategori: HSI INDIBIZ - TROUBLESHOOT
Posisi antrian: #3

Anda memiliki 3/5 tiket aktif."
```

---

## 🚀 Implementation Phases

### Phase 1: Foundation (Week 1-2)

#### Backend
- [ ] Create `agent_status` collection and model
- [ ] Create `ticket_queue` collection and model
- [ ] Implement `AgentStatusService`
- [ ] Implement basic API endpoints (go-online, go-offline, my-queue)

#### Frontend
- [ ] Create `AgentStatusToggle` component
- [ ] Add status toggle to header/navbar
- [ ] Create basic queue display

#### Testing
- [ ] Unit tests for status service
- [ ] API endpoint tests

---

### Phase 2: Auto-Assignment Engine (Week 3-4)

#### Backend
- [ ] Implement `AutoAssignmentService`
- [ ] Implement Round Robin selection algorithm
- [ ] Hook into ticket creation flow
- [ ] Implement `on_ticket_completed` trigger

#### Integration
- [ ] Update ticket creation webhook
- [ ] Update ticket completion flow
- [ ] Add queue management when agent goes offline

#### Testing
- [ ] Integration tests for assignment flow
- [ ] Load testing for concurrent assignments

---

### Phase 3: Real-time Notifications (Week 5)

#### Backend
- [ ] WebSocket for real-time updates
- [ ] Telegram notification for new assignments
- [ ] Notification for queue position changes

#### Frontend
- [ ] Real-time queue updates via WebSocket
- [ ] Toast notifications for new tickets
- [ ] Sound alert (optional)

#### Bot
- [ ] `/online` and `/offline` commands
- [ ] `/myqueue` command
- [ ] Auto-assignment notifications

---

### Phase 4: Admin Features (Week 6)

#### Backend
- [ ] Workload dashboard API
- [ ] Manual reassignment API
- [ ] Configurable max_tickets per agent
- [ ] Queue priority override

#### Frontend
- [ ] Admin Workload Dashboard
- [ ] Manual reassignment modal
- [ ] Agent settings (max tickets)
- [ ] Queue monitoring view

---

### Phase 5: Polish & Testing (Week 7-8)

- [ ] Edge case handling
- [ ] Performance optimization
- [ ] User acceptance testing
- [ ] Documentation update
- [ ] Production deployment

---

## ⚠️ Edge Cases & Considerations

### 1. No Agents Online
```
Scenario: Ticket created but no agents online
Solution: Ticket stays in queue, assigned when agent goes online
```

### 2. All Agents Full
```
Scenario: All online agents have 5 tickets
Solution: Ticket queued, assigned when any agent completes a ticket
```

### 3. Agent Goes Offline with Tickets
```
Scenario: Agent goes offline while having active tickets
Options:
  A) Keep tickets with agent (recommended for continuity)
  B) Reassign to other agents
  C) Admin configurable behavior
```

### 4. Concurrent Ticket Creation
```
Scenario: Multiple tickets created simultaneously
Solution: Use database transactions/locking to prevent double assignment
```

### 5. Agent Reconnects
```
Scenario: Agent briefly disconnects and reconnects
Solution: Grace period before marking offline (e.g., 5 minutes)
```

---

## 📊 Success Metrics

| Metric | Target |
|--------|--------|
| Assignment Time | < 2 seconds |
| Queue Wait Time | < 5 minutes average |
| Agent Utilization | 70-90% |
| No Ticket Orphaned | 0 orphaned tickets |

---

## 🔄 Migration Strategy

### Step 1: Dual Mode
- Keep "Pick Up" button active
- Add auto-assignment as optional feature
- Allow agents to opt-in

### Step 2: Gradual Rollout
- Enable auto-assignment for 50% of new tickets
- Monitor performance and feedback

### Step 3: Full Migration
- Disable "Pick Up" button
- All tickets auto-assigned
- Document changes for agents

---

## 📝 Questions for Review

1. **Assignment Algorithm**: Prefer Round Robin atau Random?
2. **Offline Behavior**: Reassign tiket atau tetap di agent?
3. **Max Tickets**: Fixed 5 atau configurable per agent?
4. **Priority Queue**: Perlu fitur prioritas untuk tiket urgent?
5. **Grace Period**: Berapa lama sebelum agent dianggap offline setelah disconnect?

---

*Last Updated: Desember 4, 2025*
