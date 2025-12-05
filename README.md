# 🎫 Telegram Bot Dashboard - Ticket Management System

Dashboard web untuk monitoring dan manajemen tiket dari bot Telegram dengan sistem role-based access untuk Admin dan Agent.

---

## 📋 Daftar Isi

1. [Fitur Utama](#-fitur-utama)
2. [Tech Stack](#-tech-stack)
3. [Arsitektur Sistem](#-arsitektur-sistem)
4. [Komponen Utama](#-komponen-utama)
5. [Alur Sistem](#-alur-sistem)
6. [Database Schema](#-database-schema)
7. [API Endpoints](#-api-endpoints)
8. [Setup & Installation](#-setup--installation)
9. [Environment Variables](#-environment-variables)
10. [User Roles](#-user-roles)
11. [Integrasi Bot](#-integrasi-bot)

---

## ✨ Fitur Utama

### 🎫 Ticket Management System
- **Format Ticket Number Baru**: `INC${MM}${DD}${YYYY}${HH}${mm}${ss}${randomText}`
  - Contoh: `INC111520251928405B6` (15 Nov 2025 19:28:40 + 5B6)
- **Template-Based Descriptions**: Setiap category + permintaan punya template khusus
- **Bullet List Display**: Description ditampilkan dengan format bullet list yang rapi
- **Category + Permintaan Display**: 
  - Format "HSI Indibiz - RECONFIG" di SEMUA tabs (10 views)
  - Badge styling dengan blue theme untuk visibility
  - Visible di: Available to Claim, My Tickets, All tabs, Open, Pending, In Progress, Completed
- **Conflict Detection**: Notifikasi otomatis saat ticket sudah diambil agent lain

### 📊 Performance Report & Analytics
- **Advanced Filtering**: Filter by Year, Month, Category, Agent
- **Two Report Views**:
  - Laporan by Agent: Performance metrics per agent
  - Laporan by Product: Statistics per category dengan kolom QC2 dan LEPAS BI
- **Performance by Product Table**: 
  - Menampilkan statistik per produk dengan kolom permintaan (INTEGRASI, PUSH BIMA, RECONFIG, REPLACE, TROUBLESHOOT)
  - Kolom tambahan QC2 dan LEPAS BI untuk tracking khusus
  - Urutan produk konsisten (QC2-HSI, QC2-WIFI, QC2-DATIN, LEPAS BI)
- **Export Options**: CSV & XLSX dengan custom column format
- **Real-time Statistics**: Dashboard dengan data hari ini, bulan ini, total
- **Export Performance Report**: Download laporan detail performa (CSV/Excel) dengan filter lengkap


### 🔐 Security & Access Control
- **JWT Authentication**: Token-based secure authentication
- **Role-Based Access**: Admin vs Agent dengan privilege berbeda
- **Conflict Prevention**: 
  - Agent tidak bisa claim ticket yang sudah assigned
  - Admin bypass conflict check (bisa reassign/unassign)
  - Agent bisa unassign ticket sendiri
- **Password Management**: Change password & reset password untuk lupa password

### 🤖 Bot Integration
- **Node.js Telegram Bot**: Fully integrated dengan FastAPI backend
- **Comment Notifications**: Real-time notification ke user via bot dengan tombol "Balas"
- **Assignment Notifications**: 
  - Notifikasi ke user saat tiket diambil agent (tanpa tombol balas)
  - Notifikasi ke grup Telegram saat tiket diambil agent
- **Completion Notifications**: 
  - Notifikasi ke user saat tiket selesai (RESOLVED)
  - Notifikasi ke grup Telegram saat tiket selesai
- **Group Telegram Notifications**: Semua aktivitas penting dikirim ke grup monitoring
- **Template System**: 40+ template berbeda untuk kombinasi category + permintaan
- **Multi-Category Support**: HSI Indibiz, WMS, BITSTREAM, VULA, ASTINET, METRO-E, QC2, LEPAS BI, dll

### 🌐 UI & Experience
- **Real-time Updates**: Status tiket dan komentar terupdate secara real-time
- **Responsive Design**: Tampilan optimal di desktop dan mobile

### 💬 2-Way Communication (Real-time)
- **User to Agent**: User kirim pesan/komentar dari bot Telegram -> Masuk ke ticket comment di Dashboard
- **Agent to User**: Agent balas komentar dari Dashboard -> User terima notifikasi real-time di Telegram
- **History Tracking**: Semua percakapan tersimpan rapi dalam history ticket
- **Media Support**: (Future) Support kirim gambar/file

### 📋 Template Categories Support

**HSI Indibiz:**
- RECONFIG, REPLACE ONT, TROUBLESHOOT, INTEGRASI

**WMS Reguler & Lite:**
- PUSH BIMA, TROUBLESHOOT

**BITSTREAM & VULA:**
- RECONFIG, REPLACE ONT, TROUBLESHOOT (dengan SVLAN/CVLAN)

**ASTINET, METRO-E, VPN IP, IP TRANSIT, SIP TRUNK, VOICE, IPTV:**
- PUSH BIMA, TROUBLESHOOT (dengan TIKET FO)

---

## 🛠️ Tech Stack

### Backend
| Teknologi | Versi | Fungsi |
|-----------|-------|--------|
| **Python** | 3.x | Bahasa pemrograman backend |
| **FastAPI** | Latest | Web framework untuk REST API |
| **Motor** | Latest | Async MongoDB driver |
| **MongoDB** | Latest | NoSQL database |
| **Pydantic** | Latest | Data validation & serialization |
| **python-jose** | Latest | JWT token generation & validation |
| **Passlib + BCrypt** | Latest | Password hashing |
| **Pandas** | Latest | Data processing untuk export CSV |
| **python-dateutil** | Latest | Date parsing & timezone handling |
| **Redis** | 5.x | In-memory data structure store (Caching) |
| **Uvicorn** | Latest | ASGI server |
| **httpx** | Latest | Async HTTP client for Telegram API |

### Frontend
| Teknologi | Versi | Fungsi |
|-----------|-------|--------|
| **React** | 19.x | UI library |
| **JavaScript** | ES6+ | Bahasa pemrograman frontend |
| **React Router** | v7 | Client-side routing |
| **Axios** | Latest | HTTP client |
| **Shadcn/UI** | Latest | Component library |
| **Radix UI** | Latest | Headless UI components |
| **Tailwind CSS** | Latest | Utility-first CSS framework |
| **Lucide React** | Latest | Icon library |
| **date-fns** | Latest | Date utility |
| **Sonner** | Latest | Toast notifications |
| **Recharts** | Latest | Chart library (future use) |

### Infrastructure
| Teknologi | Fungsi |
|-----------|--------|
| **Kubernetes** | Container orchestration |
| **Supervisor** | Process manager |
| **Nginx** | Reverse proxy |

---

## 🏗️ Arsitektur Sistem

```
┌─────────────────────────────────────────────────────────────┐
│                    TELEGRAM BOT USERS                        │
│                   (User & Agent Telegram)                    │
└──────────────────────┬──────────────────────────────────────┘
                       │
                       ↓
         ┌─────────────────────────────┐
         │     Telegram Bot Server      │
         │   (Node.js Telegram Bot)     │
         └──────────┬──────────────────┘
                    │
                    │ HTTP/HTTPS (REST API)
                    ↓
┌───────────────────────────────────────────────────────────────┐
│                    KUBERNETES CLUSTER                          │
│  ┌─────────────────────────────────────────────────────────┐  │
│  │                    Nginx Reverse Proxy                   │  │
│  │          (Route /api → Backend, / → Frontend)            │  │
│  └────────────────┬──────────────────┬────────────────────┘  │
│                   │                   │                        │
│                   ↓                   ↓                        │
│  ┌─────────────────────────┐  ┌──────────────────────────┐  │
│  │   Frontend Container     │  │   Backend Container       │  │
│  │   • React App (Port 3000)│  │   • FastAPI (Port 8001)   │  │
│  │   • Served by Nginx      │  │   • Uvicorn ASGI          │  │
│  │   • Hot reload enabled   │  │   • Hot reload enabled    │  │
│  └─────────────────────────┘  └────────┬──────────────────┘  │
│                                         │                      │
│                                         ↓                      │
│                         ┌──────────────────────────┐          │
│                         │   MongoDB Container      │          │
│                         │   • NoSQL Database       │          │
│                         │   • 3 Collections        │          │
│                         └──────────────────────────┘          │
│                                         │                      │
│                         ┌──────────────────────────┐          │
│                         │   Redis Container        │          │
│                         │   • Caching Layer        │          │
│                         │   • Dashboard Stats      │          │
│                         └──────────────────────────┘          │
└───────────────────────────────────────────────────────────────┘
                                 │
                                 ↓
                    ┌────────────────────────┐
                    │   Web Dashboard Users  │
                    │   (Admin & Agent)      │
                    └────────────────────────┘
```

---

## 📦 Komponen Utama

### Backend Components (`/app/backend/`)

#### 1. **server.py** - Main Application
```python
# Core Components:
- FastAPI Application Instance
- APIRouter dengan prefix /api
- CORS Middleware
- MongoDB Connection (Motor AsyncIOMotorClient)
- Security (HTTPBearer, JWT, BCrypt)
```

**Key Modules:**
- **Authentication Module**: Login, Register, JWT token generation
- **User Management Module**: Approve/reject agent, list users
- **Ticket Management Module**: CRUD operations, claim, update status
- **Comment Module**: Add & get comments
- **Statistics Module**: Dashboard stats (hari ini, bulan ini, total)
- **Export Module**: CSV export

#### 2. **Pydantic Models**
```python
# Data Models:
- User: User account info (id, username, role, status)
- Ticket: Extended ticket model dengan 30+ fields:
  * Basic: ticket_number (INC format), category, status, assigned_agent
  * Details: permintaan, tipe_transaksi, order_number, wonum
  * Technical: nd_internet_voice, paket_inet, sn_lama, sn_baru, tipe_ont
  * Network: gpon_slot_port, svlan, cvlan, vlan
  * Additional: task_bima, ownergroup, tiket_fo, password
- Comment: Comment on tickets (user, role, comment, timestamp, sent_to_telegram)
- DashboardStatsAdmin: Stats untuk admin dashboard
- DashboardStatsAgent: Stats untuk agent dashboard
- AgentStats: Performance stats untuk agent
- PerformanceTableData: Advanced performance report data
```

#### 3. **Security Layer**
```python
# Components:
- Password Hashing: BCrypt dengan Passlib
- JWT Tokens: python-jose dengan HS256 algorithm
- Bearer Token Authentication: FastAPI HTTPBearer
- Role-based Access Control: Depends(get_current_user)
```


## Recent Updates (December 2025)

### 🔐 Security Hardening (NEW)
- ✅ **Rate Limiting**: Login (5/min), Register (3/min) untuk mencegah brute force
- ✅ **Debug Files Removed**: Hapus file debug yang berisi kredensial
- ✅ **Console.log Removed**: Hapus semua console.log dari frontend untuk keamanan
- ✅ **JWT Token**: 24 jam session expiry

### 👨‍💻 Developer Role (December 5, 2025)
- ✅ **Developer**: Role dengan kapasitas sama seperti admin
  - Akses penuh ke Dashboard, Tickets, User Management
  - Dapat approve/reject user, reset password, delete user
  - Terpisah dari admin untuk audit trail
- ✅ **Admin List Management**: 
  - Developer dapat melihat semua admin di User Management
  - Admin biasa hanya melihat admin lain (tidak termasuk developer)
  - Delete button untuk admin users
- ✅ **Custom 500 Error Page**: 
  - Halaman error dengan ilustrasi animasi (gear & wrench)
  - Design matching dengan dashboard
  - Pesan user-friendly dalam Bahasa Indonesia

### 🔍 New Features
- ✅ **Ticket Search**: Fitur pencarian tiket di halaman Tickets
  - Cari berdasarkan: ticket number, description, category, permintaan, user, agent, WONUM, ND
  - Real-time filtering dengan hasil pencarian
- ✅ **Bot Menu Commands**: /start, /lapor, /status, /bantuan
- ✅ **Telegram Service Resilience**: Connection pooling, retry logic, timeout handling

### Two-Way Communication
- ✅ Users can now reply to agent messages via Telegram bot
- ✅ Inline "Reply" buttons in Telegram notifications
- ✅ Status-based reply restrictions (no replies on completed tickets)
- ✅ Real-time WebSocket notifications for agents

### UI/UX Improvements
- ✅ Agent Tickets page redesigned with 3-tab layout (In Progress | Pending | Completed)
- ✅ Unread message badges on ticket tabs
- ✅ Browser push notifications for new tickets and replies
- ✅ Performance Report auto-loads with current month as default
- ✅ Auto-reload on filter change (debounced)
- ✅ Empty data hidden in reports (0 values shown as blank)

### Bug Fixes
- ✅ Fixed QC2 and LEPAS BI category duplication
- ✅ Fixed QC2 description format (removed redundant "PERMINTAAN: QC2")
- ✅ Fixed year filter in performance dashboard (ISO string handling)
- ✅ Fixed bot API connection (port configuration)
- ✅ Fixed reply endpoint routing conflict

### Performance Optimizations
- ✅ Redis caching for dashboard statistics
- ✅ Debounced filter auto-reload (500ms)
- ✅ WebSocket connection health monitoring
- ✅ Telegram HTTP client connection pooling

## Contributing

Contributions are welcome! Please follow these guidelines:
1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test thoroughly
5. Submit a pull request

## License

This project is proprietary and confidential.

## Support

For issues or questions, please contact the development team.
### Frontend Components (`/app/frontend/src/`)

#### 1. **App.js** - Root Component
- Routing dengan React Router
- Authentication state management
- Axios interceptor untuk JWT token
- Protected routes

#### 2. **Pages** (`/pages/`)
```javascript
LoginPage.js
├─ Login form dengan tabs (Login/Register)
├─ JWT token storage
└─ Redirect after login

DashboardPage.js
├─ Admin Dashboard: Today, This Month, Total stats
├─ Agent Dashboard: Personal ticket statistics
└─ Conditional rendering berdasarkan role

TicketsPage.js
├─ Available Tickets to Claim (Agent only)
│  └─ Display: "Category - Permintaan" badge
├─ Tabs filter: All/My Tickets, Pending, In Progress, Completed
│  └─ Each tab shows "Category - Permintaan" badge
├─ Tab "Open" hanya untuk Admin
│  └─ Display: "Category - Permintaan" badge
└─ Ticket list dengan status badges dan category badges

TicketDetailPage.js
├─ Ticket information detail
├─ Status update dropdown (berbeda Admin vs Agent)
├─ Assign agent dropdown (Admin only)
├─ Comment system (Add & view comments)
└─ Delete ticket (Admin only)

AgentPerformancePage.js
├─ Performance metrics (Agent only)
├─ Total tickets, completed, in progress
├─ Average completion time
├─ Rating & completion rate
└─ Progress bars

UserManagementPage.js
├─ Pending user approvals (Admin only)
├─ Approve/Reject buttons
├─ Agent List with "Reset Password" feature (Admin)
├─ Reset Password dialog
└─ User list dengan badges

AccountPage.js
├─ Profile information display
├─ Change password form
├─ Password validation (min 6 characters, match confirmation)
├─ Current password verification
└─ Security tips section
```

#### 3. **Components** (`/components/`)
```javascript
Layout.js
├─ Navigation sidebar
├─ Header dengan user info & logout
├─ Conditional menu items based on role
└─ Active route highlighting

UI Components (Shadcn/UI)
├─ Button, Card, Input, Label
├─ Select, Tabs, Badge
├─ Textarea, Progress
└─ Sonner Toast notifications
```

#### 4. **Styling**
```css
• Tailwind CSS: Utility-first styling
• Custom CSS: App.css untuk global styles
• Google Fonts: Inter font family
• Color Scheme: Blue & Slate (professional)
• Responsive Design: Mobile-first approach
```

---

## 🔄 Alur Sistem

### 1. Alur Create Ticket (User → Dashboard)

```
┌──────────┐
│   USER   │
└────┬─────┘
     │ 1. Buka bot Telegram
     │ 2. /start → Create Ticket
     │ 3. Pilih kategori (HSI, WMS, dll)
     │ 4. Input deskripsi masalah
     ↓
┌──────────────┐
│ TELEGRAM BOT │
└──────┬───────┘
       │ 5. POST /api/webhook/telegram
       │    Body: {
       │      user_telegram_id,
       │      user_telegram_name,
       │      category,
       │      description
       │    }
       ↓
┌──────────────┐
│   BACKEND    │
└──────┬───────┘
       │ 6. Generate ticket_number (INC**********)
       │ 7. Create ticket dengan status "open"
       │ 8. Save ke MongoDB
       │ 9. Return ticket_number
       ↓
┌──────────────┐
│ TELEGRAM BOT │
└──────┬───────┘
       │ 10. Kirim notifikasi ke user
       │     "Ticket INC********** berhasil dibuat"
       ↓
┌──────────┐
│   USER   │ Terima konfirmasi
└──────────┘
```

### 2. Alur Claim Ticket (Agent → Dashboard)

```
┌──────────┐
│  AGENT   │
└────┬─────┘
     │ 1. Login ke web dashboard
     │    atau bot telegram (/agent)
     ↓
┌──────────────┐
│ WEB/BOT UI   │
└──────┬───────┘
       │ 2. GET /api/tickets/open/available
       │    Header: Authorization Bearer JWT
       ↓
┌──────────────┐
│   BACKEND    │
└──────┬───────┘
       │ 3. Query MongoDB: {status: "open", assigned_agent: null}
       │ 4. Return list open tickets
       ↓
┌──────────────┐
│ WEB/BOT UI   │
└──────┬───────┘
       │ 5. Tampilkan available tickets
       │ 6. Agent klik "Claim Ticket"
       ↓
┌──────────────┐
│   BACKEND    │
└──────┬───────┘
       │ 7. PUT /api/tickets/{id}
       │    Body: {
       │      assigned_agent: agent_id,
       │      assigned_agent_name: username,
       │      status: "in_progress"
       │    }
       │ 8. Update MongoDB
       │ 9. Return updated ticket
       ↓
┌──────────────┐
│ WEB/BOT UI   │
└──────┬───────┘
       │ 10. Toast notification "Ticket claimed"
       │ 11. Ticket masuk ke "My Tickets"
       ↓
┌──────────┐
│  AGENT   │ Mulai kerja on ticket
└──────────┘
```

### 3. Alur Update Status & Comment (Agent → User)

```
┌──────────┐
│  AGENT   │
└────┬─────┘
     │ 1. Buka ticket detail
     │ 2. Update status: "pending"
     ↓
┌──────────────┐
│   BACKEND    │
└──────┬───────┘
       │ 3. PUT /api/tickets/{id}
       │    Body: {status: "pending"}
       │ 4. Update MongoDB
       │ 5. Return success
       ↓
┌──────────┐
│  AGENT   │
└────┬─────┘
     │ 6. Add comment:
     │    "Sedang menunggu konfirmasi dari tim teknis"
     ↓
┌──────────────┐
│   BACKEND    │
└──────┬───────┘
       │ 7. POST /api/tickets/{id}/comments
       │    Body: {comment: "..."}
       │ 8. Save comment ke MongoDB
       │ 9. Return comment dengan timestamp
       ↓
┌──────────────┐
│ TELEGRAM BOT │
└──────┬───────┘
       │ 10. Polling: GET /api/tickets/{id}/comments
       │     (Check setiap 30 detik)
       │ 11. Deteksi new comment dari agent
       │ 12. Format notifikasi
       ↓
┌──────────┐
│   USER   │ Terima notifikasi:
└──────────┘ "Update dari agent1: Sedang menunggu..."
```

### 4. Alur Complete Ticket

```
┌──────────┐
│  AGENT   │
└────┬─────┘
     │ 1. Selesai handle ticket
     │ 2. Update status: "completed"
     ↓
┌──────────────┐
│   BACKEND    │
└──────┬───────┘
       │ 3. PUT /api/tickets/{id}
       │    Body: {status: "completed"}
       │ 4. Set completed_at timestamp
       │ 5. Update MongoDB
       │ 6. Calculate completion time
       ↓
┌──────────────┐
│   DASHBOARD  │
└──────┬───────┘
       │ 7. Update statistics:
       │    - Dashboard: completed_today++
       │    - Agent Performance: completed++
       │    - Recalculate avg_time
       ↓
┌──────────────┐
│ TELEGRAM BOT │
└──────┬───────┘
       │ 8. Send notification ke user
       │    "✅ Ticket INC********** selesai!"
       ↓
┌──────────┐
│   USER   │ Ticket resolved
└──────────┘
```

### 5. Alur Admin Dashboard Statistics

```
┌──────────┐
│  ADMIN   │
└────┬─────┘
     │ 1. Login & open dashboard
     ↓
┌──────────────┐
│   FRONTEND   │
└──────┬───────┘
       │ 2. GET /api/statistics/admin-dashboard
       │    Header: Authorization Bearer JWT
       ↓
┌──────────────┐
│   BACKEND    │
└──────┬───────┘
       │ 3. Verify JWT & check role === "admin"
       │ 4. Query all tickets from MongoDB
       │ 5. Calculate statistics:
       │
       │    TODAY:
       │    - Filter tickets by today's date
       │    - Count: received, completed, in_progress, open
       │
       │    THIS MONTH:
       │    - Filter tickets by this month
       │    - Count: received, completed
       │    - Calculate: avg_completion_time
       │    - Count: active_agents (unique assigned_agent)
       │
       │    TOTAL:
       │    - Count: all_tickets, completed
       │    - Count: total_agents from users collection
       │    - Calculate: completion_rate
       │
       │ 6. Return JSON response
       ↓
┌──────────────┐
│   FRONTEND   │
└──────┬───────┘
       │ 7. Parse response
       │ 8. Render 3 sections:
       │    - Today Cards (4 cards)
       │    - This Month Cards (4 cards)
       │    - Total Accumulation Cards (4 cards)
       ↓
┌──────────┐
│  ADMIN   │ View real-time statistics
└──────────┘
```

---

## 💾 Database Schema

### MongoDB Collections

#### 1. **users** Collection
```javascript
{
  _id: ObjectId,
  id: "uuid-string",              // Custom UUID
  username: "agent1",              // Unique username
  password_hash: "bcrypt-hash",    // Hashed password
  role: "agent",                   // "admin" atau "agent"
  status: "approved",              // "pending" atau "approved"
  created_at: ISODate("2025-...")  // ISO datetime string
}
```

**Indexes:**
- `username`: unique index
- `role`: index untuk query by role
- `status`: index untuk pending users

#### 2. **tickets** Collection
```javascript
{
  _id: ObjectId,
  id: "uuid-string",                         // Custom UUID
  ticket_number: "INC111520251928405B6",     // Format: INC{MM}{DD}{YYYY}{HH}{mm}{ss}{randomText}
  user_telegram_id: "123456789",             // Telegram user ID
  user_telegram_name: "John Doe",            // Telegram user name
  category: "HSI Indibiz",                   // Service category
  permintaan: "RECONFIG",                    // Request type
  description: "TIPE TRANSAKSI: AO\n...",    // Structured description (multi-line)
  status: "in_progress",                     // open/pending/in_progress/completed
  assigned_agent: "agent-uuid",              // Agent ID (null if not assigned)
  assigned_agent_name: "agent1",             // Agent username
  
  // Extended Fields (template-based)
  tipe_transaksi: "AO",                      // AO/PDA/MO/DO/SO/RO
  order_number: "SC1002090518",              // Order number
  wonum: "WO037823026",                      // Work order number
  nd_internet_voice: "161316004321",         // ND number
  paket_inet: "HSIEF300M",                   // Package
  sn_lama: "HWTC12345678",                   // Old serial number
  sn_baru: "ZTEGDA82DF31",                   // New serial number
  tipe_ont: "F670 V2.0",                     // ONT type
  gpon_slot_port: "172.20.167.4 SLOT 2...",  // GPON details
  svlan: "100",                              // SVLAN (BITSTREAM/VULA)
  cvlan: "200",                              // CVLAN (BITSTREAM/VULA)
  vlan: "300",                               // VLAN (other services)
  task_bima: "Pull Dropcore",                // BIMA task
  ownergroup: "TIF HD 123",                  // Owner group
  tiket_fo: "INF123456",                     // Fiber optic ticket
  password: "pass1234",                      // Password field
  sn_ap: "AP1234567",                        // AP serial (WMS)
  mac_ap: "AA:BB:CC:DD:EE:FF",               // AP MAC (WMS)
  ssid: "WIFI_1234",                         // SSID (WMS)
  keterangan_lainnya: "Additional notes",    // Other notes
  
  // Timestamps
  created_at: ISODate("2025-..."),           // Created timestamp
  updated_at: ISODate("2025-..."),           // Last update timestamp
  completed_at: ISODate("2025-...") | null   // Completion timestamp
}
```

**Indexes:**
- `ticket_number`: unique index
- `status`: index untuk filter by status
- `assigned_agent`: index untuk agent queries
- `created_at`: index untuk date range queries

#### 3. **comments** Collection
```javascript
{
  _id: ObjectId,
  id: "uuid-string",              // Custom UUID
  ticket_id: "ticket-uuid",       // Reference to tickets.id
  user_id: "user-uuid",           // Reference to users.id
  username: "agent1",             // Username for display
  role: "agent",                  // "admin" atau "agent"
  comment: "Sedang dicek...",     // Comment text
  timestamp: ISODate("2025-..."), // Comment timestamp
  sent_to_telegram: false         // Flag untuk tracking notifikasi
}
```

**Indexes:**
- `ticket_id`: index untuk get comments by ticket
- `timestamp`: index untuk sorting

---

## 🔌 API Endpoints

### Authentication Endpoints

#### POST `/api/auth/register`
**Deskripsi:** Register user baru (agent)  
**Auth:** None  
**Body:**
```json
{
  "username": "agent4",
  "password": "password123",
  "role": "agent"
}
```
**Response:**
```json
{
  "id": "uuid",
  "username": "agent4",
  "role": "agent",
  "status": "pending",
  "created_at": "2025-10-29T..."
}
```

#### POST `/api/auth/login`
**Deskripsi:** Login & get JWT token  
**Auth:** None  
**Body:**
```json
{
  "username": "admin",
  "password": "admin123"
}
```
**Response:**
```json
{
  "access_token": "eyJhbGc...",
  "token_type": "bearer",
  "user": {
    "id": "uuid",
    "username": "admin",
    "role": "admin",
    "status": "approved"
  }
}
```

### User Management Endpoints (Admin Only)

#### POST `/users/create-admin`
**Deskripsi:** Create second admin (admin2)  
**Auth:** Bearer Token (Admin)  
**Response:** Created admin user object


#### GET `/api/users/pending`
**Deskripsi:** Get pending user approvals  
**Auth:** Bearer Token (Admin)  
**Response:** Array of pending users

#### PUT `/api/users/{user_id}/approve`
**Deskripsi:** Approve pending user  
**Auth:** Bearer Token (Admin)  
**Response:** Updated user object

#### DELETE `/api/users/{user_id}`
**Deskripsi:** Delete/reject user  
**Auth:** Bearer Token (Admin)  
**Response:** Success message

#### PUT `/api/users/change-password`
**Deskripsi:** User change their own password  
**Auth:** Bearer Token  
**Body:**
```json
{
  "current_password": "oldpassword123",
  "new_password": "newpassword123"
}
```
**Response:**
```json
{
  "message": "Password changed successfully"
}
```

#### PUT `/api/users/{user_id}/reset-password`
**Deskripsi:** Admin reset user password (for forgot password case)  
**Auth:** Bearer Token (Admin)  
**Body:**
```json
{
  "new_password": "newpassword123"
}
```
**Response:**
```json
{
  "message": "Password reset successfully"
}
```

#### GET `/api/users/agents`
**Deskripsi:** Get all approved agents  
**Auth:** Bearer Token (Admin)  
**Response:** Array of agent users

### Ticket Endpoints


#### POST `/api/webhook/telegram`
**Deskripsi:** Create ticket dari bot  
**Auth:** None (public webhook)  
**Body:**
```json
{
  "user_telegram_id": "123456",
  "user_telegram_name": "User",
  "category": "HSI Indibiz",
  "description": "Problem description"
}
```
**Response:** Created ticket object

#### GET `/api/tickets`
**Deskripsi:** Get tickets (filtered by role & status)  
**Auth:** Bearer Token  
**Query Params:**
- `status` (optional): open, pending, in_progress, completed  
**Response:** Array of tickets

#### GET `/api/tickets/open/available`
**Deskripsi:** Get open tickets untuk di-claim  
**Auth:** Bearer Token  
**Response:** Array of open, unassigned tickets

#### GET `/api/tickets/{ticket_id}`
**Deskripsi:** Get ticket detail  
**Auth:** Bearer Token  
**Response:** Ticket object

#### PUT `/api/tickets/{ticket_id}`
**Deskripsi:** Update ticket (claim, status, assign)  
**Auth:** Bearer Token  
**Conflict Detection:**
- Returns 409 Conflict jika ticket sudah assigned ke agent lain
- Admin bypass conflict check
- Unassign (set to None) tidak ada conflict
**Body:**
```json
{
  "status": "completed",
  "assigned_agent": "agent-uuid",
  "assigned_agent_name": "agent1"
}
```
**Response:** 
- 200: Updated ticket object
- 409: `{"detail": "Ticket sudah diambil oleh agent1. Silakan pilih ticket lain."}`

#### DELETE `/api/tickets/{ticket_id}`
**Deskripsi:** Delete ticket  
**Auth:** Bearer Token (Admin)  
**Response:** Success message

### Comment Endpoints

#### POST `/api/tickets/{ticket_id}/comments`
**Deskripsi:** Add comment to ticket  
**Auth:** Bearer Token  
**Body:**
```json
{
  "comment": "Sedang dicek oleh tim teknis"
}
```
**Response:** Created comment object

#### GET `/api/tickets/{ticket_id}/comments`
**Deskripsi:** Get all comments for ticket  
**Auth:** Bearer Token  
**Response:** Array of comments

### Statistics Endpoints

#### GET `/api/statistics/admin-dashboard`
**Deskripsi:** Get admin dashboard statistics  
**Auth:** Bearer Token (Admin)  
**Response:**
```json
{
  "today": {
    "received": 5,
    "completed": 2,
    "in_progress": 2,
    "open": 1
  },
  "this_month": {
    "received": 50,
    "completed": 30,
    "avg_time": 2.5,
    "active_agents": 3
  },
  "total": {
    "all_tickets": 200,
    "completed": 150,
    "total_agents": 5
  }
}
```

#### GET `/api/statistics/agent-dashboard/{agent_id}`
**Deskripsi:** Get agent personal dashboard stats  
**Auth:** Bearer Token (Agent)  
**Response:** Similar structure dengan data agent saja

#### GET `/api/statistics/agent/{agent_id}`
**Deskripsi:** Get agent performance metrics  
**Auth:** Bearer Token  
**Response:**
```json
{
  "total_tickets": 20,
  "completed_tickets": 15,
  "in_progress_tickets": 3,
  "avg_completion_time_hours": 2.3,
  "rating": 4.8
}
```

### Export Endpoints

#### GET `/api/export/tickets`
**Deskripsi:** Export all tickets to CSV or XLSX  
**Auth:** Bearer Token (Admin)  
**Query Params:**
- `format`: csv or xlsx (default: csv)  
**Response:** CSV/XLSX file download dengan kolom:
- Ticket Number, Created Date, Updated Date, Completed Date
- User Telegram ID, User Telegram Name
- Category, Description, Status, Assigned Agent

**Filename Format:** `tickets_export_YYYY-MM-DD.{csv|xlsx}`

#### GET `/api/export/performance`
**Deskripsi:** Export detailed performance report  
**Auth:** Bearer Token (Admin)  
**Query Params:**
- `year`: Filter by year (e.g., 2025)
- `month`: Filter by month (1-12)
- `category`: Filter by ticket category
- `agent_id`: Filter by specific agent
- `format`: csv or xlsx (default: csv)

**Response:** CSV/XLSX file dengan kolom:
- Ticket Number, Created Date, Completed Date
- User Name, Category, Description
- Agent Name, Status, Duration (hours)
- Duration Category, < 1 Hour, 2-3 Hours, > 3 Hours

**Filename Format:** `performance_report_{year}_{month}_{category}_{agent}_{date}.{csv|xlsx}`


- Agent Name, Status, Duration (hours)
- Duration Category, < 1 Hour, 2-3 Hours, > 3 Hours

**Filename Format:** `performance_report_{year}_{month}_{category}_{agent}_{date}.{csv|xlsx}`

### Performance Report Endpoints

#### GET `/api/performance/table-data`
**Deskripsi:** Get performance table data with filtering  
**Auth:** Bearer Token (Admin)  
**Query Params:**
- `year`: Filter by year
- `month`: Filter by month (1-12)
- `category`: Filter by category
- `agent_id`: Filter by agent

**Response:**
```json
{
  "data": [
    {
      "agent": "agent1",
      "agent_id": "uuid",
      "total": 20,
      "completed": 15,
      "in_progress": 3,
      "pending": 2,
      "completion_rate": 75.0,
      "under_1hr": 5,
      "between_2_3hr": 8,
      "over_3hr": 2,
      "categories": {
        "HSI Indibiz": 5,
        "WMS Reguler": 10,
        ...
      }
    }
  ],
  "summary": {...},
  "categories": ["HSI Indibiz", "WMS Reguler", ...]
}
```

#### GET `/api/performance/by-agent`
**Deskripsi:** Get performance summary grouped by agent (Laporan Agent)  
**Auth:** Bearer Token (Admin)  
**Query Params:** Same as table-data  
**Response:** Array of agent performance summaries

#### GET `/api/performance/by-product`
**Deskripsi:** Get performance summary grouped by product/category (Laporan By Product)  
**Auth:** Bearer Token (Admin)  
**Query Params:** Same as table-data  
**Response:** Array of category performance summaries


### Comment Notification Endpoints (Bot Integration)

#### GET `/api/comments/pending-telegram`
**Deskripsi:** Get comments pending to be sent to Telegram (for bot polling)  
**Auth:** None (Public for bot)  
**Response:**
```json
[
  {
    "comment_id": "uuid",
    "ticket_id": "uuid",
    "ticket_number": "TKT-000001",
    "user_telegram_id": "123456",
    "user_telegram_name": "User Name",
    "agent_username": "agent1",
    "comment": "Sedang dicek...",
    "timestamp": "2025-01-15T10:30:00Z"
  }
]
```

#### PUT `/api/comments/{comment_id}/mark-sent`
**Deskripsi:** Mark comment as sent to Telegram  
**Auth:** None (Public for bot)  
**Response:**
```json
{
  "message": "Comment marked as sent to Telegram"
}
```


#### POST `/api/users/create-admin`
**Deskripsi:** Create second admin user (admin2)  
**Auth:** Bearer Token (Admin)  
**Response:**
```json
{
  "message": "Admin2 created successfully",
  "username": "admin2",
  "password": "admin123",
  "role": "admin"
}
```

### Category & Years Endpoints

#### GET `/api/tickets/categories`
**Deskripsi:** Get list of all unique ticket categories  
**Auth:** Bearer Token  
**Response:**
```json
{
  "categories": ["HSI Indibiz", "WMS Reguler", "BITSTREAM", ...]
}
```

#### GET `/api/tickets/years`
**Deskripsi:** Get list of years from tickets (for filtering)  
**Auth:** Bearer Token  
**Response:**
```json
{
  "years": [2025, 2024]
}
```

---

## 🚀 Setup & Installation

### Prerequisites

**System Requirements:**
- Operating System: Linux (Ubuntu/Debian recommended)
- Docker & Kubernetes cluster
- RAM: Minimum 4GB
- Storage: Minimum 10GB

**Required Software:**
- Python 3.9 or higher
- Node.js 16.x or higher
- Yarn 1.22 or higher
- MongoDB 5.0 or higher
- Supervisor (process manager)
- Nginx (reverse proxy)

### Installation Steps

#### 1. Install System Dependencies

**For Ubuntu/Debian:**
```bash
# Update system
sudo apt update && sudo apt upgrade -y

# Install Python and pip
sudo apt install python3 python3-pip -y

# Install Node.js and Yarn
curl -fsSL https://deb.nodesource.com/setup_16.x | sudo -E bash -
sudo apt install nodejs -y
npm install -g yarn

# Install MongoDB
wget -qO - https://www.mongodb.org/static/pgp/server-5.0.asc | sudo apt-key add -
echo "deb [ arch=amd64,arm64 ] https://repo.mongodb.org/apt/ubuntu focal/mongodb-org/5.0 multiverse" | sudo tee /etc/apt/sources.list.d/mongodb-org-5.0.list
sudo apt update
sudo apt install mongodb-org -y
sudo systemctl start mongod
sudo systemctl enable mongod

# Install Supervisor
sudo apt install supervisor -y

# Install Nginx
sudo apt install nginx -y
```

**For macOS:**
```bash
# Install Homebrew (if not installed)
/bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"

# Install dependencies
brew install python3 node mongodb supervisor nginx
npm install -g yarn
```

#### 2. Verify Installations

```bash
# Check Python version (should be 3.9+)
python3 --version

# Check Node.js version (should be 16+)
node --version

# Check Yarn version
yarn --version

# Check MongoDB
mongod --version

# Check if MongoDB is running
sudo systemctl status mongod  # Linux
brew services list | grep mongodb  # macOS
```

### Backend Setup

#### 1. Navigate to backend directory
```bash
cd /app/backend
```

#### 2. Create virtual environment (recommended)
```bash
python3 -m venv venv
source venv/bin/activate  # Linux/macOS
# or
.\venv\Scripts\activate  # Windows
```

#### 3. Install Python dependencies
```bash
pip install --upgrade pip
pip install -r requirements.txt
```

**Backend Dependencies List:**
- `fastapi` - Web framework
- `uvicorn[standard]` - ASGI server
- `motor` - Async MongoDB driver
- `python-dotenv` - Environment variables
- `pydantic` - Data validation
- `python-jose[cryptography]` - JWT tokens
- `passlib[bcrypt]` - Password hashing
- `pandas` - Data processing
- `openpyxl` - Excel export support
- `httpx` - Async HTTP client (Telegram API)

#### 4. Setup environment variables
```bash
cp .env.example .env
nano .env  # Edit with your configuration
```

**Required Environment Variables:**
```bash
MONGO_URL=mongodb://localhost:27017
DB_NAME=telegram_ticket_db
SECRET_KEY=your-secret-key-min-32-characters-long
ALGORITHM=HS256
ACCESS_TOKEN_EXPIRE_MINUTES=1440
CORS_ORIGINS=http://localhost:3000,https://your-domain.com
BOT_TOKEN=your-telegram-bot-token
GROUP_CHAT_ID=-100xxxxxxxxxx
```

#### 5. Test backend
```bash
# Run manually to test
uvicorn server:app --host 0.0.0.0 --port 8001 --reload

# Or use supervisor
sudo supervisorctl start backend
```

#### 6. Verify backend is running
```bash
# Check logs
tail -f /var/log/supervisor/backend.err.log

# Test API
curl http://localhost:8001/api/auth/login
```

### Frontend Setup

#### 1. Navigate to frontend directory
```bash
cd /app/frontend
```

#### 2. Install Node.js dependencies
```bash
yarn install
```

**Frontend Dependencies List:**

**Core:**
- `react` (^19.x) - UI library
- `react-dom` - React DOM renderer
- `react-router-dom` - Client-side routing
- `axios` - HTTP client

**UI Components:**
- `@radix-ui/react-dialog` - Modal dialogs
- `@radix-ui/react-dropdown-menu` - Dropdown menus
- `@radix-ui/react-label` - Form labels
- `@radix-ui/react-progress` - Progress bars
- `@radix-ui/react-select` - Select inputs
- `@radix-ui/react-tabs` - Tab navigation
- `lucide-react` - Icon library

**Styling:**
- `tailwindcss` - Utility CSS framework
- `postcss` - CSS processing
- `autoprefixer` - CSS vendor prefixes

**Utilities:**
- `date-fns` - Date formatting
- `sonner` - Toast notifications
- `class-variance-authority` - Component variants
- `clsx` - Conditional classnames
- `tailwind-merge` - Merge Tailwind classes

**Charts (optional):**
- `recharts` - Chart library

#### 3. Setup environment variables
```bash
cp .env.example .env
nano .env  # Edit with your configuration
```

**Required Environment Variables:**
```bash
REACT_APP_BACKEND_URL=https://your-domain.com
REACT_APP_ENABLE_VISUAL_EDITS=false
ENABLE_HEALTH_CHECK=false
```

#### 4. Build frontend (for production)
```bash
yarn build
```

#### 5. Run frontend
```bash
# Development mode
yarn start

# Or use supervisor
sudo supervisorctl start frontend
```

#### 6. Verify frontend is running
```bash
# Check logs
tail -f /var/log/supervisor/frontend.err.log

# Access in browser
open http://localhost:3000
```

### Database Setup

#### 1. Connect to MongoDB
```bash
mongosh  # or mongo (for older versions)
```

#### 2. Create database and indexes
```javascript
use telegram_ticket_db

// Create indexes for users collection
db.users.createIndex({ "username": 1 }, { unique: true })
db.users.createIndex({ "role": 1 })
db.users.createIndex({ "status": 1 })

// Create indexes for tickets collection
db.tickets.createIndex({ "ticket_number": 1 }, { unique: true })
db.tickets.createIndex({ "status": 1 })
db.tickets.createIndex({ "assigned_agent": 1 })
db.tickets.createIndex({ "created_at": -1 })

// Create indexes for comments collection
db.comments.createIndex({ "ticket_id": 1 })
db.comments.createIndex({ "timestamp": -1 })
```

#### 3. Seed initial data (optional)
The backend automatically creates:
- Admin user (username: `admin`, password: `admin123`)
- 3 Sample agents (agent1, agent2, agent3)

### Redis Setup (Caching)

#### 1. Install Redis
**Windows:**
- Use WSL2 (Recommended)
- Or use Docker: `docker run -d -p 6379:6379 redis`
- Or use Memurai (Redis-compatible for Windows)

**Linux/Mac:**
```bash
sudo apt install redis-server
sudo service redis-server start
```

#### 2. Verify Redis
```bash
redis-cli ping
# Output: PONG
```

### Service Configuration

#### 1. Configure Supervisor

Create supervisor config files:

**Backend (`/etc/supervisor/conf.d/backend.conf`):**
```ini
[program:backend]
directory=/app/backend
command=/usr/bin/python3 -m uvicorn server:app --host 0.0.0.0 --port 8001 --reload
autostart=true
autorestart=true
stderr_logfile=/var/log/supervisor/backend.err.log
stdout_logfile=/var/log/supervisor/backend.out.log
```

**Frontend (`/etc/supervisor/conf.d/frontend.conf`):**
```ini
[program:frontend]
directory=/app/frontend
command=/usr/bin/yarn start
autostart=true
autorestart=true
stderr_logfile=/var/log/supervisor/frontend.err.log
stdout_logfile=/var/log/supervisor/frontend.out.log
environment=PORT=3000
```

#### 2. Reload supervisor
```bash
sudo supervisorctl reread
sudo supervisorctl update
sudo supervisorctl start all
```

### Check Services

```bash
# Check all services status
sudo supervisorctl status

# Expected output:
# backend                          RUNNING   pid 1234, uptime 0:01:23
# frontend                         RUNNING   pid 1235, uptime 0:01:23
```

### Nginx Configuration (Optional - for production)

Create nginx config (`/etc/nginx/sites-available/telegram-dashboard`):

```nginx
server {
    listen 80;
    server_name your-domain.com;

    # Frontend
    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }

    # Backend API
    location /api {
        proxy_pass http://localhost:8001;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

Enable site:
```bash
sudo ln -s /etc/nginx/sites-available/telegram-dashboard /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl reload nginx
```

### Troubleshooting

#### Backend Issues

**Port already in use:**
```bash
# Find process using port 8001
sudo lsof -i :8001
# Kill process
sudo kill -9 <PID>
```

**MongoDB connection failed:**
```bash
# Check MongoDB status
sudo systemctl status mongod
# Restart MongoDB
sudo systemctl restart mongod
```

**Import errors:**
```bash
# Reinstall dependencies
pip install -r requirements.txt --force-reinstall
```

#### Frontend Issues

**Port 3000 already in use:**
```bash
# Find and kill process
sudo lsof -i :3000
sudo kill -9 <PID>
```

**Build errors:**
```bash
# Clear cache and reinstall
rm -rf node_modules yarn.lock
yarn install
```

**Module not found errors:**
```bash
# Install missing dependencies
yarn add <package-name>
```

### Verification

#### 1. Test Backend API
```bash
# Health check
curl http://localhost:8001

# Login test
curl -X POST http://localhost:8001/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"admin123"}'
```

#### 2. Test Frontend
```bash
# Open in browser
open http://localhost:3000

# Should see login page
```

#### 3. Test Database
```bash
# Check collections
mongosh telegram_ticket_db --eval "show collections"

# Count users
mongosh telegram_ticket_db --eval "db.users.countDocuments()"
```

### Production Deployment

#### 1. Build frontend for production
```bash
cd /app/frontend
yarn build
```

#### 2. Serve with Nginx
```bash
# Copy build to nginx directory
sudo cp -r build/* /var/www/telegram-dashboard/
```

#### 3. Use production environment variables
```bash
# Backend
export ENV=production
export DEBUG=false

# Frontend
export NODE_ENV=production
```

#### 4. Enable HTTPS with Let's Encrypt
```bash
sudo apt install certbot python3-certbot-nginx
sudo certbot --nginx -d your-domain.com
```

---

## 🔐 Environment Variables

### Backend (`.env`)
```bash
# MongoDB Configuration
MONGO_URL=mongodb://localhost:27017
DB_NAME=telegram_ticket_db
REDIS_URL=redis://localhost:6379

# JWT Configuration
SECRET_KEY=your-secret-key-change-in-production
ALGORITHM=HS256
ACCESS_TOKEN_EXPIRE_MINUTES=1440

# CORS Configuration
CORS_ORIGINS=http://localhost:3000,https://your-domain.com
```

### Frontend (`.env`)
```bash
# Backend API URL
REACT_APP_BACKEND_URL=http://localhost:8000

# Feature Flags
REACT_APP_ENABLE_VISUAL_EDITS=false
ENABLE_HEALTH_CHECK=false
```

---

## 👥 User Roles

### Admin
**Capabilities:**
- ✅ View all tickets (semua status, semua agent)
- ✅ Create/Edit/Delete tickets
- ✅ Assign tickets ke agent
- ✅ **Reassign tickets tanpa conflict** (admin bypass)
- ✅ **Unassign tickets kembali ke open** (reset ticket)
- ✅ Update ticket status (open, pending, in_progress, completed)
- ✅ View all agent performance
- ✅ Approve/Reject agent registrations
- ✅ **Reset agent passwords (lupa password)**
- ✅ **Change own password**
- ✅ Export data ke CSV/XLSX dengan custom format
- ✅ Access User Management page
- ✅ Access Performance Report dengan 2 views (by Agent, by Product)
- ❌ TIDAK ada menu "My Performance"

**Dashboard View:**
- Today: Tickets Received, Completed, In Progress, Open
- This Month: Total Received, Completed, Avg Time (created → completed), Active Agents
- Total: All Time Tickets, Total Completed, Total Agents, Completion Rate
- Export buttons: CSV and XLSX with date in filename

**Performance Report:**
- Advanced filtering: Year, Month, Category, Agent
- Table with 9 columns: Agent, Rate %, < 1hr, 2-3hr, > 3hr, Pending, In Progress, Completed, Total
- Summary row with totals
- Export filtered data to CSV/XLSX with date columns

**Account Settings:**
- Profile information
- Change password
- View account details

**User Management:**
- Approve/Reject pending agent registrations
- View all approved agents
- Reset password untuk agent yang lupa password
- Each agent has "Reset Password" button

### Agent
**Capabilities:**
- ✅ View assigned tickets only
- ✅ Claim open tickets dari "Available Tickets to Claim"
- ✅ **Conflict detection**: Notifikasi otomatis jika ticket sudah diambil agent lain
- ✅ **Unassign own ticket**: Bisa release ticket yang sudah di-claim
- ✅ Update ticket status (in_progress, pending, completed)
- ✅ Add comments to tickets
- ✅ View personal performance metrics
- ✅ **Change own password**
- ❌ TIDAK bisa claim ticket yang sudah assigned ke agent lain
- ❌ TIDAK bisa assign tickets ke agent lain
- ❌ TIDAK bisa delete tickets
- ❌ TIDAK bisa approve users
- ❌ TIDAK bisa export data
- ❌ TIDAK bisa reset password agent lain

**Dashboard View:**
- Today: Tickets Received, Completed, In Progress, Pending
- This Month: Total Received, Completed, Avg Time, Completion Rate
- Total: All Time Tickets, Total Completed, Overall Rate

**My Performance View:**
- Total Tickets, Completed, In Progress
- Average Completion Time
- Rating & Progress Bars

**Account Settings:**
- Profile information
- Change password form with validation:
  - Current password verification
  - New password (min 6 characters)
  - Confirm password
- Security tips

---

## 🤖 Integrasi Bot

### Quick Start

1. **Baca dokumentasi lengkap:**
```bash
cat /app/BOT_INTEGRATION_COMPLETE_GUIDE.md
```

2. **Test webhook:**
```bash
curl -X POST http://localhost:8000/api/webhook/telegram \
  -H "Content-Type: application/json" \
  -d '{
    "user_telegram_id": "123456",
    "user_telegram_name": "Test User",
    "category": "HSI Indibiz",
    "description": "Test ticket from curl"
  }'
```

3. **Implement bot dengan Python:**
- Copy code dari `BOT_INTEGRATION_COMPLETE_GUIDE.md`
- Update `BOT_TOKEN` dengan token Anda
- Run bot: `python bot.py`

### Key Integration Points

1. **User create ticket:** `POST /webhook/telegram`
2. **Agent claim ticket:** `GET /tickets/open/available` → `PUT /tickets/{id}`
3. **Agent update status:** `PUT /tickets/{id}`
4. **Agent add comment:** `POST /tickets/{id}/comments`
5. **Bot get pending comments:** `GET /comments/pending-telegram` (polling, no auth required)
6. **Bot mark comment sent:** `PUT /comments/{comment_id}/mark-sent`

### Comment Notification Flow

Bot polling untuk notifikasi comment ke user:

```python
# Bot polling every 10 seconds
while True:
    # Get pending comments (no auth needed)
    response = requests.get(f"{API_URL}/comments/pending-telegram")
    comments = response.json()
    
    for comment in comments:
        # Send to user via Telegram
        bot.send_message(
            chat_id=comment['user_telegram_id'],
            text=f"Update dari {comment['agent_username']}:\n{comment['comment']}"
        )
        
        # Mark as sent
        requests.put(f"{API_URL}/comments/{comment['comment_id']}/mark-sent")
    
    time.sleep(10)
```

---

## 📊 Monitoring & Logs

### Check Backend Logs
```bash
tail -f /var/log/supervisor/backend.err.log
tail -f /var/log/supervisor/backend.out.log
```

### Check Frontend Logs
```bash
tail -f /var/log/supervisor/frontend.err.log
tail -f /var/log/supervisor/frontend.out.log
```

### Service Control
```bash
# Restart services
sudo supervisorctl restart backend
sudo supervisorctl restart frontend

# Stop services
sudo supervisorctl stop backend frontend

# Start services
sudo supervisorctl start backend frontend
```

---

## 🧪 Testing

### Manual Testing Credentials

**Admin:**
- Username: `admin` / `admin2`
- Password: `admin123`

**Agent:**
- Username: `agent1` / `agent2` / `agent3`
- Password: `admin123`

### Demo Data

**Seed Demo Tickets:**
```bash
curl -X POST http://localhost:8000/api/database/reset-tickets \
  -H "Authorization: Bearer <admin_token>"
```

**Create Second Admin:**
```bash
curl -X POST http://localhost:8000/api/users/create-admin \
  -H "Authorization: Bearer <admin_token>"
```

### Test Endpoints

```bash
# Login
curl -X POST http://localhost:8000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"admin123"}'

# Create ticket via webhook
curl -X POST http://localhost:8000/api/webhook/telegram \
  -H "Content-Type: application/json" \
  -d '{
    "user_telegram_id": "999",
    "user_telegram_name": "Test User",
    "category": "WMS Reguler",
    "description": "Test description"
  }'
```

---

## 📝 License

Proprietary - All rights reserved

---

## 👨‍💻 Development

### Project Structure
```
/app/
├── backend/
│   ├── server.py           # Main FastAPI application
│   ├── requirements.txt    # Python dependencies
│   └── .env               # Backend environment variables
├── frontend/
│   ├── src/
│   │   ├── App.js         # Root component
│   │   ├── pages/         # Page components
│   │   │   ├── LoginPage.js
│   │   │   ├── DashboardPage.js
│   │   │   ├── TicketsPage.js
│   │   │   ├── TicketDetailPage.js
│   │   │   ├── AgentPerformancePage.js
│   │   │   ├── UserManagementPage.js
│   │   │   └── AccountPage.js          # NEW: Account settings
│   │   ├── components/    # Reusable components
│   │   │   ├── Layout.js
│   │   │   └── ui/        # Shadcn UI components
│   │   └── lib/           # Utilities
│   ├── package.json       # Node dependencies
│   └── .env              # Frontend environment variables
├── tests/                 # Test files
├── README.md             # This file
├── BOT_INTEGRATION_COMPLETE_GUIDE.md  # Bot integration guide
└── TELEGRAM_BOT_INTEGRATION.md        # Quick reference
```

### Code Style
- **Backend:** PEP 8 (Python)
- **Frontend:** Airbnb JavaScript Style Guide
- **Format:** Prettier for JS/JSX, Black for Python

---

## 🆘 Support

For issues or questions:
1. Check logs: `/var/log/supervisor/`
2. Review documentation: `BOT_INTEGRATION_COMPLETE_GUIDE.md`
3. Test endpoints dengan curl
4. Check MongoDB collections

---

## 🆕 Latest Updates (November 2025)

### Ticket Number Format Update
- **Old Format**: `TKT-000001` (Sequential)
- **New Format**: `INC111520251928405B6` (Timestamp-based)
- **Benefits**:
  - Unique ticket numbers guaranteed
  - Timestamp embedded in ticket number
  - No database counting required
  - Better for distributed systems

### Template-Based Ticket Descriptions
- **40+ Template Combinations** untuk category + permintaan
- **Auto-formatting** dengan bullet list di UI
- **Field Validation** sesuai template masing-masing
- **Structured Data** untuk easy parsing dan reporting

### Advanced Conflict Detection
```javascript
// Scenario Matrix
┌─────────────────────┬───────────┬──────────┬─────────┐
│ Scenario            │ User      │ Action   │ Result  │
├─────────────────────┼───────────┼──────────┼─────────┤
│ Available ticket    │ Agent     │ Claim    │ ✅ OK   │
│ Already assigned    │ Agent     │ Claim    │ ❌ 409  │
│ Already assigned    │ Admin     │ Reassign │ ✅ OK   │
│ Already assigned    │ Admin     │ Unassign │ ✅ OK   │
│ Own ticket          │ Agent     │ Unassign │ ✅ OK   │
└─────────────────────┴───────────┴──────────┴─────────┘
```

### Performance Report Enhancements
- **Two Report Views**:
  1. **Laporan Agent**: Performance metrics per agent
  2. **Laporan By Product**: Statistics per category
- **Advanced Filtering**: Year, Month, Category, Agent
- **Export Format**: Custom XLSX dengan 15+ columns
- **Real-time Updates**: Auto-refresh statistics

### Enhanced Ticket List Display (All Tabs)

**Comprehensive UI Update - 10 Views:**

```
Agent Views (5):                     Admin Views (5):
├─ Available to Claim               ├─ All Tickets
├─ My Tickets (All)                 ├─ Open Tickets  
├─ Pending                          ├─ Pending
├─ In Progress                      ├─ In Progress
└─ Completed                        └─ Completed
```

**Each View Now Shows:**
- ✅ Badge format: "HSI Indibiz - RECONFIG"
- ✅ Blue styling: bg-blue-100, text-blue-700
- ✅ Tag icon included
- ✅ Description preview: line-clamp-2
- ✅ Consistent design across all tabs

**Benefits:**
- 📈 **Efficiency**: Agent langsung lihat permintaan tanpa klik detail
- 🎯 **Filtering**: Mudah identifikasi ticket by permintaan type
- 👀 **Visibility**: Blue badge stands out di list view
- ⚡ **Speed**: Faster decision making untuk claim/assign tickets
- 🎨 **Consistency**: Same UI pattern di semua tabs

### UI/UX Improvements
- **Category + Permintaan Display**: Universal badge across 10 views
- **Bullet List Descriptions**: Clean, structured display with ul/li HTML
- **Conflict Notifications**: Toast messages dengan error details
- **Responsive Design**: Mobile-friendly interface
- **Description Preview**: line-clamp-2 untuk tampilan rapi di list view
- **Consistent Styling**: Same badge design across all 10 ticket list views

---

## 📈 Performance Metrics

### System Capacity
- **Concurrent Users**: 100+ simultaneous connections
- **Ticket Processing**: 1000+ tickets per day
- **Response Time**: < 200ms for API calls
- **Database**: MongoDB with indexed queries

### Scalability
- **Horizontal Scaling**: Ready for Kubernetes deployment
- **Load Balancing**: Nginx reverse proxy
- **Caching**: Redis support (optional)
- **CDN Ready**: Static asset optimization

---

## 🔧 Configuration Examples

### UI Component: Category + Permintaan Badge

**Display Format Across All Tabs:**
```jsx
// Frontend component (TicketsPage.js)
<span className="inline-flex items-center gap-1 px-2 py-1 bg-blue-100 text-blue-700 rounded-md font-medium">
  <Tag className="w-4 h-4" />
  {ticket.category}
  {ticket.permintaan && (
    <span className="text-blue-600"> - {ticket.permintaan}</span>
  )}
</span>
```

**Visual Example:**
```
┌─────────────────────────────────────────────────┐
│ INC111520251928405B6              [in_progress] │
│ TIPE TRANSAKSI: AO                              │
│ NOMOR ORDER: SC1002090518...                    │
│                                                 │
│ [HSI Indibiz - RECONFIG]  agent1  Nov 15, 2025│
│  └─ Blue badge              └─ Metadata        │
└─────────────────────────────────────────────────┘
```

**Affected Views (10 total):**
- Agent: Available to Claim, My Tickets, Pending, In Progress, Completed
- Admin: All, Open, Pending, In Progress, Completed

### Ticket Template Configuration
```python
# Example: HSI Indibiz RECONFIG template
template = {
    "category": "HSI Indibiz",
    "permintaan": "RECONFIG",
    "fields": [
        "TIPE TRANSAKSI",
        "NOMOR ORDER",
        "WONUM",
        "ND INET/VOICE",
        "PAKET INET",
        "SN ONT",
        "TIPE ONT",
        "GPON SLOT/PORT/ONU",
        "KETERANGAN LAINNYA"
    ]
}
```

### Conflict Detection Rules
```python
# Backend logic
def check_conflict(current_ticket, update_data, current_user):
    is_admin = current_user.role == 'admin'
    is_unassigning = update_data.assigned_agent is None
    
    if is_admin or is_unassigning:
        return False  # No conflict
    
    if current_ticket.assigned_agent and \
       current_ticket.assigned_agent != update_data.assigned_agent:
        return True  # Conflict detected
    
    return False
```

---

**Built with my sick brain for efficient ticket management**


*Last Updated: Desember 4, 2025*
*sakit pala eug*