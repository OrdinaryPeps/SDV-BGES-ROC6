# 🚀 Future Development Plan - BotSDV v2

## Overview

Dokumen ini berisi rencana pengembangan fitur-fitur baru untuk sistem tiket BotSDV. Terdiri dari 2 fitur utama:

1. **Auto-Assignment Ticket System** - Sistem distribusi tiket otomatis
2. **Image Upload in Comments** - Fitur upload gambar di komentar

---

# 📌 FEATURE 1: Auto-Assignment Ticket System

## Executive Summary

Sistem tiket berubah dari manual "Pick Up" menjadi **Auto-Assignment**:
- Random/Round-Robin assignment ke agent online
- Limit maksimal 5 tiket per agent
- Serial queue system (FIFO)
- Auto-refill saat agent menyelesaikan tiket

---

## Requirements

### Functional Requirements
| ID | Requirement |
|----|-------------|
| FR-01 | Agent dapat set status Online/Offline |
| FR-02 | Tiket baru auto-assign ke agent online dengan slot tersedia |
| FR-03 | Maksimal 5 tiket aktif per agent |
| FR-04 | Saat tiket selesai, tiket baru otomatis masuk ke antrian paling bawah |
| FR-05 | Admin dapat melihat workload semua agent |
| FR-06 | Admin dapat manual reassign jika diperlukan |

---

## Architecture

### System Flow
```
USER (Telegram) → TICKET QUEUE → AUTO-ASSIGNMENT ENGINE → AGENTS
                                          │
                      ┌───────────────────┼───────────────────┐
                      ▼                   ▼                   ▼
               Agent 1 [3/5]      Agent 2 [5/5]       Agent 3 [0/5]
               🟢 Online          🟢 FULL             🔴 Offline
               ✓ Eligible         ✗ Full              ✗ Offline
```

### Ticket Lifecycle
```
QUEUED → ASSIGNED → IN_PROGRESS → COMPLETED
                          ↓
                   TRIGGER AUTO-ASSIGN NEW TICKET
```

---

## Database Schema

### Collection: `agent_status`
```javascript
{
  agent_id: "uuid",
  agent_name: "agent1",
  is_online: true,
  last_online: ISODate(),
  current_tickets: 3,
  max_tickets: 5,
  assignment_order: 1,
  last_assigned: ISODate()
}
```

### Collection: `ticket_queue`
```javascript
{
  ticket_id: "uuid",
  status: "queued",  // queued | assigned | completed
  position: 1,
  assigned_agent: null,
  agent_queue_position: null,
  queued_at: ISODate()
}
```

---

## Backend Implementation

### Core Service: `auto_assignment.py`
```python
class AutoAssignmentService:
    async def assign_new_ticket(self, ticket_id: str):
        # 1. Get eligible agents (online + slots available)
        eligible_agents = await self.get_eligible_agents()
        
        if not eligible_agents:
            await self.add_to_queue(ticket_id)
            return None
        
        # 2. Select agent (Round Robin)
        selected = await self.select_next_agent(eligible_agents)
        
        # 3. Assign & notify
        await self.assign_ticket_to_agent(ticket_id, selected.id)
        await self.notify_agent(selected, ticket_id)
        
        return selected.id
    
    async def on_ticket_completed(self, ticket_id, agent_id):
        # Decrement count, check queue, assign next ticket
        await self.decrement_agent_tickets(agent_id)
        next_ticket = await self.get_next_queued_ticket()
        if next_ticket:
            await self.assign_ticket_to_agent(next_ticket.id, agent_id)
```

### API Endpoints
```python
POST /api/agent-status/go-online    # Set online
POST /api/agent-status/go-offline   # Set offline
GET  /api/agent-status/my-queue     # Get personal queue
GET  /api/agent-status/workload     # Admin: all agents workload
```

---

## Frontend Implementation

### Agent Dashboard UI
```
┌─────────────────────────────────────────────────┐
│  🟢 Online                      [Go Offline]    │
├─────────────────────────────────────────────────┤
│  📋 My Ticket Queue (3/5)                       │
│  ─────────────────────────────────────────────  │
│  #1 • INC... | HSI INDIBIZ | 🔵 In Progress    │
│  #2 • INC... | WMSLite     | 🟡 Pending        │
│  #3 • INC... | BITSTREAM   | 🟡 Pending        │
│  ─────────────────────────────────────────────  │
│  ℹ️ 2 slots available                           │
└─────────────────────────────────────────────────┘
```

---

## Telegram Bot Updates

```javascript
/online   - Set status online
/offline  - Set status offline
/myqueue  - View ticket queue
/status   - Check status

// Notification
"🎫 Tiket baru: INC...
Kategori: HSI INDIBIZ - TROUBLESHOOT
Posisi antrian: #3
Tiket aktif: 3/5"
```

---

## Implementation Phases

| Phase | Duration | Focus |
|-------|----------|-------|
| **Phase 1** | Week 1-2 | Agent status, basic queue |
| **Phase 2** | Week 3-4 | Auto-assignment engine |
| **Phase 3** | Week 5 | Real-time notifications |
| **Phase 4** | Week 6 | Admin features |
| **Phase 5** | Week 7-8 | Testing & deployment |

---

## Edge Cases

| Scenario | Solution |
|----------|----------|
| No agents online | Ticket stays in queue |
| All agents full | Ticket queued, assign when slot available |
| Agent goes offline | Keep tickets (recommended) |
| Concurrent requests | Database locking |

---

## Questions for Review

1. **Algorithm**: Round Robin atau Random?
2. **Offline Behavior**: Reassign atau tetap di agent?
3. **Max Tickets**: Fixed 5 atau configurable?
4. **Priority Queue**: Perlu untuk tiket urgent?
5. **Grace Period**: Berapa lama sebelum offline?

---

# 📌 FEATURE 2: Image Upload in Comments

## Overview

Agent dan User dapat mengirim gambar dalam komentar tiket:
- **User (Telegram)**: Kirim foto langsung via bot
- **Agent (Dashboard)**: Tombol lampiran, paste screenshot, drag & drop

---

## Architecture

```
┌──────────────────────────────────────────────────────┐
│                    IMAGE FLOW                         │
├──────────────────────────────────────────────────────┤
│                                                       │
│  USER (Telegram)              AGENT (Dashboard)      │
│  ┌───────────┐                ┌───────────────┐      │
│  │Kirim Foto │                │ 📎 Attach     │      │
│  │via Bot    │                │ 📋 Paste Ctrl+V│     │
│  └─────┬─────┘                │ 🖱️ Drag&Drop  │      │
│        │                      └───────┬───────┘      │
│        ▼                              ▼              │
│  ┌───────────┐                ┌───────────────┐      │
│  │Telegram   │                │ Upload API    │      │
│  │file_id    │                │ → R2/S3       │      │
│  └─────┬─────┘                └───────┬───────┘      │
│        │                              │              │
│        └──────────┬───────────────────┘              │
│                   ▼                                  │
│            ┌───────────┐                             │
│            │  MongoDB  │                             │
│            │(image URL)│                             │
│            └─────┬─────┘                             │
│                  │                                   │
│        ┌─────────┴─────────┐                        │
│        ▼                   ▼                        │
│  ┌───────────┐      ┌───────────────┐              │
│  │ Telegram  │      │   Dashboard   │              │
│  │(User view)│      │ (Agent view)  │              │
│  └───────────┘      └───────────────┘              │
│                                                      │
└──────────────────────────────────────────────────────┘
```

---

## Storage Options

| Option | Cost | Storage | Speed | Recommended |
|--------|------|---------|-------|-------------|
| **Cloudflare R2** | Free 10GB | Unlimited | Fast | ✅ Production |
| **Telegram Storage** | Free | Unlimited | Fast | ✅ MVP |
| **AWS S3** | $0.023/GB | Unlimited | Fast | ⚪ Alternative |
| **VPS Local** | Free | Limited | Medium | ❌ Not recommended |

### Recommendation
- **MVP/Development**: Telegram Storage (gratis, mudah)
- **Production**: Cloudflare R2 (10GB free, CDN cepat)

---

## Database Schema Update

```javascript
// comments collection - updated
{
  _id: ObjectId,
  ticket_id: "uuid",
  user_id: "uuid",
  user_name: "agent1",
  text: "Ini screenshot error nya",
  
  // NEW: attachments
  attachments: [
    {
      type: "image",
      url: "https://r2.domain.com/tickets/123/img1.jpg",
      thumbnail_url: "https://r2.domain.com/tickets/123/img1_thumb.jpg",
      file_size: 125000,
      original_name: "screenshot.png",
      uploaded_at: ISODate()
    }
  ],
  
  source: "dashboard",  // "telegram" | "dashboard"
  created_at: ISODate()
}
```

---

## Frontend: Comment Box with Image Upload

### UI Design
```
┌─────────────────────────────────────────────────────┐
│  💬 Tambah Komentar                                 │
├─────────────────────────────────────────────────────┤
│  ┌───────────────────────────────────────────────┐  │
│  │ Ketik pesan atau paste gambar (Ctrl+V)...     │  │
│  │                                               │  │
│  │  ┌─────────┐  ┌─────────┐                    │  │
│  │  │ 🖼️ img1 │  │ 🖼️ img2 │  ❌                 │  │
│  │  └─────────┘  └─────────┘                    │  │
│  └───────────────────────────────────────────────┘  │
│                                                     │
│  [📎 Lampirkan] [📋 Paste]          [Kirim 📤]     │
└─────────────────────────────────────────────────────┘
```

### Implementation
```javascript
const CommentBox = ({ ticketId }) => {
  const [text, setText] = useState('');
  const [images, setImages] = useState([]);
  
  // Paste Screenshot (Ctrl+V)
  const handlePaste = (e) => {
    const items = e.clipboardData.items;
    for (let item of items) {
      if (item.type.startsWith('image/')) {
        setImages(prev => [...prev, item.getAsFile()]);
      }
    }
  };
  
  // File Select
  const handleFileSelect = (e) => {
    const files = Array.from(e.target.files);
    setImages(prev => [...prev, ...files]);
  };
  
  // Drag & Drop
  const handleDrop = (e) => {
    e.preventDefault();
    const files = Array.from(e.dataTransfer.files)
      .filter(f => f.type.startsWith('image/'));
    setImages(prev => [...prev, ...files]);
  };
  
  // Submit
  const handleSubmit = async () => {
    const formData = new FormData();
    formData.append('text', text);
    images.forEach(img => formData.append('images', img));
    await axios.post(`/api/comments/${ticketId}`, formData);
  };
  
  return (
    <div onPaste={handlePaste} onDrop={handleDrop}>
      <textarea value={text} onChange={e => setText(e.target.value)} />
      <div className="previews">
        {images.map((img, i) => (
          <img key={i} src={URL.createObjectURL(img)} />
        ))}
      </div>
      <input type="file" accept="image/*" multiple onChange={handleFileSelect} />
      <button onClick={handleSubmit}>Kirim</button>
    </div>
  );
};
```

---

## Backend: Image Upload Service

### Cloudflare R2 Implementation
```python
# services/image_upload.py
import boto3
from PIL import Image
import io

class ImageUploadService:
    def __init__(self):
        self.s3 = boto3.client('s3',
            endpoint_url=settings.R2_ENDPOINT,
            aws_access_key_id=settings.R2_ACCESS_KEY,
            aws_secret_access_key=settings.R2_SECRET_KEY
        )
    
    async def upload_image(self, file, ticket_id: str) -> dict:
        # 1. Validate
        if file.size > 5 * 1024 * 1024:  # 5MB limit
            raise ValueError("File too large")
        
        # 2. Compress
        img = Image.open(file)
        if img.width > 1920:
            img.thumbnail((1920, 1920))
        
        buffer = io.BytesIO()
        img.save(buffer, format='JPEG', quality=85)
        buffer.seek(0)
        
        # 3. Upload
        filename = f"tickets/{ticket_id}/{uuid4()}.jpg"
        self.s3.upload_fileobj(buffer, 'botsdv-images', filename)
        
        # 4. Create thumbnail
        thumb_url = await self.create_thumbnail(img, ticket_id)
        
        return {
            "url": f"{settings.R2_PUBLIC_URL}/{filename}",
            "thumbnail_url": thumb_url,
            "file_size": file.size
        }
```

### Telegram Storage Alternative
```python
# Simpan via Telegram (gratis)
async def upload_via_telegram(file) -> str:
    msg = await bot.send_photo(PRIVATE_CHANNEL_ID, file)
    file_id = msg.photo[-1].file_id
    file_info = await bot.get_file(file_id)
    return f"https://api.telegram.org/file/bot{TOKEN}/{file_info.file_path}"
```

---

## API Endpoints

```python
# POST /api/comments/{ticket_id}
# Content-Type: multipart/form-data
{
  "text": "Ini screenshot error",
  "images": [File, File, ...]
}

# Response
{
  "id": "comment_uuid",
  "text": "Ini screenshot error",
  "attachments": [
    {"url": "...", "thumbnail_url": "...", "file_size": 125000}
  ]
}
```

---

## Image Upload Limits

| Limit | Value |
|-------|-------|
| Max file size | 5 MB |
| Max images per comment | 3 |
| Max resolution | 1920x1920 |
| Supported formats | JPG, PNG, GIF, WEBP |
| Thumbnail size | 200x200 |

---

## Implementation Phases

| Phase | Duration | Focus |
|-------|----------|-------|
| **Phase 1** | Week 1 | Storage setup (R2/Telegram) |
| **Phase 2** | Week 2 | Backend upload API |
| **Phase 3** | Week 3 | Frontend CommentBox update |
| **Phase 4** | Week 4 | Bot integration |
| **Phase 5** | Week 5 | Testing & optimization |

---

# 📅 Combined Roadmap

## Timeline Overview

| Month | Focus |
|-------|-------|
| **Month 1** | Image Upload Feature |
| **Month 2-3** | Auto-Assignment System |
| **Month 4** | Testing & Production Deployment |

---

## Priority Order

1. ⭐ **Image Upload** - Smaller scope, immediate value
2. ⭐⭐ **Auto-Assignment** - Major feature, requires more testing

---

*Last Updated: Desember 4, 2025*
