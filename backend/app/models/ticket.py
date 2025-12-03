from pydantic import BaseModel, Field, ConfigDict
from typing import Optional
from datetime import datetime, timezone
import uuid

class TicketCreate(BaseModel):
    ticket_number: Optional[str] = None
    user_telegram_id: str
    user_telegram_name: str
    category: str
    description: str
    permintaan: Optional[str] = None
    tipe_transaksi: Optional[str] = None
    order_number: Optional[str] = None
    wonum: Optional[str] = None
    tiket_fo: Optional[str] = None
    nd_internet_voice: Optional[str] = None
    password: Optional[str] = None
    paket_inet: Optional[str] = None
    sn_lama: Optional[str] = None
    sn_baru: Optional[str] = None
    sn_ap: Optional[str] = None
    mac_ap: Optional[str] = None
    ssid: Optional[str] = None
    tipe_ont: Optional[str] = None
    gpon_slot_port: Optional[str] = None
    vlan: Optional[str] = None
    svlan: Optional[str] = None
    cvlan: Optional[str] = None
    task_bima: Optional[str] = None
    ownergroup: Optional[str] = None
    link_chat: Optional[str] = None
    keterangan_lainnya: Optional[str] = None
    # Lepas BI fields
    bi_id: Optional[str] = None
    cfs_id: Optional[str] = None
    id_bi: Optional[str] = None
    rfs_id: Optional[str] = None

class TicketUpdate(BaseModel):
    status: Optional[str] = None
    assigned_agent: Optional[str] = None
    assigned_agent_name: Optional[str] = None

class Ticket(TicketCreate):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    status: str = "open"
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    updated_at: Optional[datetime] = None
    completed_at: Optional[datetime] = None
    assigned_agent: Optional[str] = None
    assigned_agent_name: Optional[str] = None
