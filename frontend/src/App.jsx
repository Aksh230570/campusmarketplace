import { useState, useEffect, useRef, useCallback } from "react";
import { GoogleLogin } from "@react-oauth/google";
import { AuthProvider, useAuth } from "./context/AuthContext";
import { listingsAPI, chatsAPI, aiAPI, usersAPI } from "./services/api";
import { io } from "socket.io-client";

// ── Design tokens ─────────────────────────
const C = {
  primary: "#2563eb", primaryLight: "#eff6ff",
  surface: "#ffffff", bg: "#f8fafc",
  border: "#e2e8f0", text: "#0f172a",
  muted: "#64748b", light: "#94a3b8",
};

const CATEGORIES = ["Electronics","Books & Notes","Clothing","Furniture","Sports & Fitness","Stationery","Food & Beverages","Instruments","Vehicles","Services","Hostel Essentials","Other"];

// ── Tiny shared components ────────────────
function Badge({ children, color = "default" }) {
  const map = { default:["#f1f5f9","#475569"], blue:["#eff6ff","#1d4ed8"], green:["#f0fdf4","#15803d"], red:["#fef2f2","#dc2626"], amber:["#fffbeb","#b45309"], purple:["#faf5ff","#7e22ce"] };
  const [bg, txt] = map[color] || map.default;
  return <span style={{ background: bg, color: txt, fontSize: 11, fontWeight: 500, padding: "3px 8px", borderRadius: 6, whiteSpace: "nowrap" }}>{children}</span>;
}

function Avatar({ name = "?", pic, size = 32 }) {
  const initials = name.split(" ").map(w => w[0]).join("").slice(0, 2).toUpperCase();
  const colors = ["#2563eb","#7c3aed","#0891b2","#059669","#dc2626","#d97706"];
  const bg = colors[(initials.charCodeAt(0) + (initials.charCodeAt(1) || 0)) % colors.length];
  if (pic) return <img src={pic} alt={name} style={{ width: size, height: size, borderRadius: "50%", objectFit: "cover", flexShrink: 0 }} />;
  return <div style={{ width: size, height: size, borderRadius: "50%", background: bg, color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", fontSize: size * 0.36, fontWeight: 600, flexShrink: 0 }}>{initials}</div>;
}

function Stars({ rating }) {
  return <span style={{ display: "flex", gap: 2, alignItems: "center" }}>
    {[1,2,3,4,5].map(i => <svg key={i} width="12" height="12" viewBox="0 0 12 12" fill={i <= Math.round(rating) ? "#f59e0b" : "#e2e8f0"}><polygon points="6,1 7.5,4.5 11,4.5 8.5,7 9.5,11 6,8.5 2.5,11 3.5,7 1,4.5 4.5,4.5"/></svg>)}
    <span style={{ fontSize: 11, color: C.muted }}>{rating?.toFixed(1) || "0.0"}</span>
  </span>;
}

function Spinner({ size = 18 }) {
  return <span style={{ display: "inline-block", width: size, height: size, border: `2px solid #e2e8f0`, borderTopColor: C.primary, borderRadius: "50%", animation: "spin 0.7s linear infinite" }} />;
}

function AIButton({ label, loading, onClick }) {
  return (
    <button onClick={onClick} disabled={loading} style={{ display: "flex", alignItems: "center", gap: 5, background: loading ? "#f1f5f9" : C.primaryLight, color: loading ? C.light : C.primary, border: "none", borderRadius: 8, padding: "5px 10px", fontSize: 12, fontWeight: 600, cursor: loading ? "not-allowed" : "pointer" }}>
      {loading ? <><Spinner size={12} /> Working...</> : `✦ ${label}`}
    </button>
  );
}

// ── Listing Card ──────────────────────────
function ListingCard({ listing, onClick, onWishlist }) {
  const condColor = { New:"green","Like New":"blue",Good:"default",Fair:"amber",Poor:"red" };
  return (
    <div onClick={() => onClick(listing)} style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 12, overflow: "hidden", cursor: "pointer", transition: "box-shadow 0.18s, transform 0.18s" }}
      onMouseEnter={e => { e.currentTarget.style.boxShadow = "0 4px 20px rgba(0,0,0,0.10)"; e.currentTarget.style.transform = "translateY(-2px)"; }}
      onMouseLeave={e => { e.currentTarget.style.boxShadow = "none"; e.currentTarget.style.transform = "none"; }}>
      <div style={{ position: "relative" }}>
        <img src={listing.images?.[0]?.url || "https://images.unsplash.com/photo-1555041469-a586c61ea9bc?w=400&h=280&fit=crop"} alt={listing.title} style={{ width: "100%", height: 168, objectFit: "cover", display: "block" }} />
        {listing.isUrgent && <span style={{ position: "absolute", top: 8, left: 8, background: "#ef4444", color: "#fff", fontSize: 10, fontWeight: 700, padding: "2px 7px", borderRadius: 5 }}>URGENT</span>}
        <button onClick={e => { e.stopPropagation(); onWishlist(listing._id); }} style={{ position: "absolute", top: 8, right: 8, background: "rgba(255,255,255,0.9)", border: "none", borderRadius: "50%", width: 30, height: 30, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill={listing.wishlisted ? "#ef4444" : "none"} stroke={listing.wishlisted ? "#ef4444" : "#64748b"} strokeWidth="2"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/></svg>
        </button>
        {listing.status === "sold" && <div style={{ position: "absolute", inset: 0, background: "rgba(0,0,0,0.55)", display: "flex", alignItems: "center", justifyContent: "center" }}><span style={{ color: "#fff", fontWeight: 700, fontSize: 20 }}>SOLD</span></div>}
      </div>
      <div style={{ padding: "12px 14px" }}>
        <p style={{ margin: "0 0 4px", fontSize: 14, fontWeight: 600, color: C.text, lineHeight: 1.3 }}>{listing.title}</p>
        <p style={{ margin: "0 0 8px", fontSize: 18, fontWeight: 700, color: C.primary }}>₹{listing.price?.toLocaleString("en-IN")}</p>
        <div style={{ display: "flex", gap: 5, flexWrap: "wrap", marginBottom: 8 }}>
          <Badge color={condColor[listing.condition] || "default"}>{listing.condition}</Badge>
          <Badge>{listing.category}</Badge>
          {listing.negotiable && <Badge color="purple">Negotiable</Badge>}
        </div>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <Avatar name={listing.seller?.name || "?"} pic={listing.seller?.profilePic} size={22} />
            <span style={{ fontSize: 12, color: C.muted }}>{listing.seller?.name}</span>
          </div>
          <span style={{ fontSize: 11, color: C.light }}>{listing.views} views</span>
        </div>
      </div>
    </div>
  );
}

// ── Navbar ────────────────────────────────
function Navbar({ page, setPage }) {
  const { user, logout } = useAuth();
  const [showNotifs, setShowNotifs] = useState(false);
  const [notifs, setNotifs] = useState([]);

  useEffect(() => {
    usersAPI.getNotifications().then(r => setNotifs(r.data)).catch(() => {});
  }, []);

  const unread = notifs.filter(n => !n.read).length;

  return (
    <nav style={{ background: C.surface, borderBottom: `1px solid ${C.border}`, position: "sticky", top: 0, zIndex: 50 }}>
      <div style={{ maxWidth: 1200, margin: "0 auto", padding: "0 20px", display: "flex", alignItems: "center", gap: 16, height: 60 }}>
        <div onClick={() => setPage("home")} style={{ cursor: "pointer", display: "flex", alignItems: "center", gap: 8, flexShrink: 0 }}>
          <div style={{ width: 32, height: 32, borderRadius: 8, background: C.primary, display: "flex", alignItems: "center", justifyContent: "center" }}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.5"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>
          </div>
          <span style={{ fontWeight: 800, fontSize: 16, color: C.text }}>Campus<span style={{ color: C.primary }}>Market</span></span>
        </div>
        <div style={{ flex: 1, display: "flex", gap: 2 }}>
          {[["home","Browse"],["create","Sell"],["chats","Chats"],["my-listings","My Listings"],["wishlist","Wishlist"]].map(([k, l]) => (
            <button key={k} onClick={() => setPage(k)} style={{ background: "none", border: "none", cursor: "pointer", padding: "6px 12px", borderRadius: 8, fontSize: 13.5, fontWeight: page === k ? 600 : 400, color: page === k ? C.primary : C.muted }}>
              {l}
            </button>
          ))}
        </div>
        <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
          <div style={{ position: "relative" }}>
            <button onClick={() => setShowNotifs(!showNotifs)} style={{ background: "none", border: "none", cursor: "pointer", padding: 6, borderRadius: 8 }}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={C.muted} strokeWidth="2"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/></svg>
              {unread > 0 && <span style={{ position: "absolute", top: 2, right: 2, background: "#ef4444", color: "#fff", fontSize: 9, fontWeight: 700, borderRadius: "50%", width: 16, height: 16, display: "flex", alignItems: "center", justifyContent: "center" }}>{unread}</span>}
            </button>
            {showNotifs && (
              <div style={{ position: "absolute", right: 0, top: "calc(100% + 8px)", background: C.surface, border: `1px solid ${C.border}`, borderRadius: 12, width: 310, boxShadow: "0 8px 30px rgba(0,0,0,0.12)", zIndex: 100 }}>
                <div style={{ padding: "12px 16px", borderBottom: `1px solid ${C.border}`, display: "flex", justifyContent: "space-between" }}>
                  <span style={{ fontWeight: 600, fontSize: 14 }}>Notifications</span>
                  <button onClick={() => { usersAPI.markAllRead(); setNotifs(n => n.map(x => ({...x, read: true}))); }} style={{ background: "none", border: "none", cursor: "pointer", fontSize: 12, color: C.primary }}>Mark all read</button>
                </div>
                {notifs.slice(0, 6).map(n => (
                  <div key={n._id} style={{ padding: "10px 16px", background: n.read ? "transparent" : "#eff6ff", borderBottom: `1px solid ${C.border}` }}>
                    <p style={{ margin: 0, fontSize: 12.5, color: C.text }}>{n.message}</p>
                    <p style={{ margin: "2px 0 0", fontSize: 11, color: C.light }}>{new Date(n.createdAt).toLocaleString()}</p>
                  </div>
                ))}
                {notifs.length === 0 && <p style={{ padding: "20px", textAlign: "center", color: C.muted, fontSize: 13 }}>No notifications yet</p>}
              </div>
            )}
          </div>
          <button onClick={() => setPage("profile")} style={{ display: "flex", alignItems: "center", gap: 8, background: "none", border: `1px solid ${C.border}`, borderRadius: 20, padding: "4px 12px 4px 4px", cursor: "pointer" }}>
            <Avatar name={user?.name} pic={user?.profilePic} size={28} />
            <span style={{ fontSize: 13, fontWeight: 500, color: C.text }}>{user?.name?.split(" ")[0]}</span>
          </button>
        </div>
      </div>
      <div style={{ background: "#eff6ff", padding: "5px 20px", borderTop: "1px solid #bfdbfe", display: "flex", gap: 8, alignItems: "center" }}>
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke={C.primary} strokeWidth="2"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>
        <span style={{ fontSize: 12, color: "#1d4ed8" }}>Listings from <strong>{user?.college?.name || user?.collegeDomain}</strong></span>
      </div>
    </nav>
  );
}

// ── Home Page ─────────────────────────────
function HomePage({ setPage, setSelectedListing }) {
  const [listings, setListings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [cat, setCat] = useState("All");
  const [sort, setSort] = useState("-createdAt");
  const [minPrice, setMinPrice] = useState("");
  const [maxPrice, setMaxPrice] = useState("");

  const fetchListings = useCallback(async () => {
    setLoading(true);
    try {
      const params = { sort, limit: 20 };
      if (search) params.search = search;
      if (cat !== "All") params.category = cat;
      if (minPrice) params.minPrice = minPrice;
      if (maxPrice) params.maxPrice = maxPrice;
      const res = await listingsAPI.getAll(params);
      setListings(res.data.listings || []);
    } catch (e) { console.error(e); }
    setLoading(false);
  }, [search, cat, sort, minPrice, maxPrice]);

  useEffect(() => { fetchListings(); }, [fetchListings]);

  const handleWishlist = async (id) => {
    await listingsAPI.toggleWishlist(id);
    setListings(ls => ls.map(l => l._id === id ? { ...l, wishlisted: !l.wishlisted } : l));
  };

  return (
    <div style={{ maxWidth: 1200, margin: "0 auto", padding: "24px 20px" }}>
      <div style={{ display: "flex", gap: 12, marginBottom: 16 }}>
        <div style={{ flex: 1, position: "relative" }}>
          <svg style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)" }} width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={C.light} strokeWidth="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search listings..." style={{ width: "100%", padding: "10px 40px", border: `1px solid ${C.border}`, borderRadius: 10, fontSize: 14, outline: "none", boxSizing: "border-box" }} onKeyDown={e => e.key === "Enter" && fetchListings()} />
        </div>
        <select value={sort} onChange={e => setSort(e.target.value)} style={{ padding: "10px 14px", border: `1px solid ${C.border}`, borderRadius: 10, fontSize: 13, outline: "none", cursor: "pointer" }}>
          <option value="-createdAt">Newest first</option>
          <option value="price">Price: Low → High</option>
          <option value="-price">Price: High → Low</option>
          <option value="-views">Most viewed</option>
        </select>
      </div>

      <div style={{ display: "flex", gap: 8, overflowX: "auto", paddingBottom: 8, marginBottom: 16 }}>
        {["All", ...CATEGORIES].map(c => (
          <button key={c} onClick={() => setCat(c)} style={{ flexShrink: 0, padding: "6px 14px", borderRadius: 20, border: `1px solid ${cat === c ? C.primary : C.border}`, background: cat === c ? C.primary : "white", color: cat === c ? "#fff" : C.muted, fontSize: 13, cursor: "pointer" }}>{c}</button>
        ))}
      </div>

      <div style={{ display: "flex", gap: 20 }}>
        <div style={{ width: 190, flexShrink: 0 }}>
          <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 12, padding: 16 }}>
            <p style={{ margin: "0 0 10px", fontWeight: 600, fontSize: 13 }}>Price (₹)</p>
            <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
              <input type="number" placeholder="Min" value={minPrice} onChange={e => setMinPrice(e.target.value)} style={{ width: "100%", padding: "7px 8px", border: `1px solid ${C.border}`, borderRadius: 8, fontSize: 13, outline: "none" }} />
              <span style={{ color: C.light }}>—</span>
              <input type="number" placeholder="Max" value={maxPrice} onChange={e => setMaxPrice(e.target.value)} style={{ width: "100%", padding: "7px 8px", border: `1px solid ${C.border}`, borderRadius: 8, fontSize: 13, outline: "none" }} />
            </div>
            <button onClick={() => { setMinPrice(""); setMaxPrice(""); }} style={{ marginTop: 8, width: "100%", padding: "6px", border: `1px solid ${C.border}`, borderRadius: 8, background: "none", cursor: "pointer", fontSize: 12, color: C.muted }}>Reset</button>
          </div>
        </div>

        <div style={{ flex: 1 }}>
          {loading ? (
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(240px, 1fr))", gap: 16 }}>
              {[1,2,3,4,5,6].map(i => <div key={i} style={{ height: 280, background: "#f1f5f9", borderRadius: 12, animation: "pulse 1.5s ease-in-out infinite" }} />)}
            </div>
          ) : listings.length === 0 ? (
            <div style={{ textAlign: "center", padding: "60px 20px" }}>
              <p style={{ color: C.muted }}>No listings found. Try different filters.</p>
            </div>
          ) : (
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(240px, 1fr))", gap: 16 }}>
              {listings.map(l => (
                <ListingCard key={l._id} listing={l} onClick={l => { setSelectedListing(l); setPage("listing-detail"); }} onWishlist={handleWishlist} />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Listing Detail ────────────────────────
function ListingDetailPage({ listing: initialListing, setPage }) {
  const [listing, setListing] = useState(initialListing);
  const [aiTips, setAiTips] = useState([]);
  const [loadingTips, setLoadingTips] = useState(false);

  useEffect(() => {
    if (initialListing?._id) {
      listingsAPI.getOne(initialListing._id).then(r => setListing(r.data)).catch(() => {});
    }
  }, [initialListing?._id]);

  const getAINegotiationTips = async () => {
    setLoadingTips(true);
    try {
      const res = await aiAPI.negotiationTips({
        role: "buyer",
        itemTitle: listing.title,
        askingPrice: listing.price,
      });
      setAiTips(res.data.tips || []);
    } catch { setAiTips(["Politely explain your budget constraints.", "Ask if accessories are included.", "Offer to meet and inspect before paying."]); }
    setLoadingTips(false);
  };

  if (!listing) return null;
  const condColor = { New:"green","Like New":"blue",Good:"default",Fair:"amber",Poor:"red" };

  return (
    <div style={{ maxWidth: 1200, margin: "0 auto", padding: "24px 20px" }}>
      <button onClick={() => setPage("home")} style={{ background: "none", border: "none", cursor: "pointer", color: C.primary, fontSize: 13, marginBottom: 16, display: "flex", alignItems: "center", gap: 6 }}>
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="15 18 9 12 15 6"/></svg>
        Back to listings
      </button>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 360px", gap: 24 }}>
        <div>
          <img src={listing.images?.[0]?.url || ""} alt={listing.title} style={{ width: "100%", borderRadius: 12, objectFit: "cover", maxHeight: 400 }} />
          {listing.images?.length > 1 && (
            <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
              {listing.images.slice(0, 6).map((img, i) => (
                <img key={i} src={img.url} alt="" style={{ width: 72, height: 56, borderRadius: 8, objectFit: "cover", border: `2px solid ${i === 0 ? C.primary : C.border}`, cursor: "pointer" }} />
              ))}
            </div>
          )}
          <div style={{ marginTop: 20, background: C.surface, border: `1px solid ${C.border}`, borderRadius: 12, padding: 20 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "start", marginBottom: 12 }}>
              <div>
                <div style={{ display: "flex", gap: 6, marginBottom: 8 }}>
                  <Badge>{listing.category}</Badge>
                  <Badge color={condColor[listing.condition] || "default"}>{listing.condition}</Badge>
                  {listing.negotiable && <Badge color="purple">Negotiable</Badge>}
                  {listing.isUrgent && <Badge color="red">Urgent</Badge>}
                </div>
                <h1 style={{ margin: 0, fontSize: 22, fontWeight: 700, color: C.text }}>{listing.title}</h1>
              </div>
              <p style={{ margin: 0, fontSize: 26, fontWeight: 800, color: C.primary }}>₹{listing.price?.toLocaleString("en-IN")}</p>
            </div>
            <p style={{ fontSize: 14, color: C.muted, lineHeight: 1.7 }}>{listing.description}</p>

            {/* AI Negotiation Tips */}
            <div style={{ marginTop: 16, background: "#f0fdf4", border: "1px solid #bbf7d0", borderRadius: 10, padding: 14 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: aiTips.length ? 10 : 0 }}>
                <span style={{ fontSize: 13, fontWeight: 600, color: "#15803d" }}>✦ AI Negotiation Tips</span>
                {aiTips.length === 0 && <AIButton label="Get Tips" loading={loadingTips} onClick={getAINegotiationTips} />}
              </div>
              {aiTips.map((t, i) => <p key={i} style={{ margin: "4px 0", fontSize: 13, color: "#166534" }}>• {t}</p>)}
            </div>
          </div>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 12, padding: 16 }}>
            <p style={{ margin: "0 0 12px", fontWeight: 600, fontSize: 13 }}>Seller</p>
            <div style={{ display: "flex", gap: 10, alignItems: "center", marginBottom: 12 }}>
              <div style={{ position: "relative" }}>
                <Avatar name={listing.seller?.name} pic={listing.seller?.profilePic} size={44} />
                <span style={{ position: "absolute", bottom: 1, right: 1, width: 10, height: 10, borderRadius: "50%", background: "#22c55e", border: "2px solid white" }} />
              </div>
              <div>
                <p style={{ margin: 0, fontWeight: 600, fontSize: 14 }}>{listing.seller?.name}</p>
                <Stars rating={listing.seller?.rating?.average || 0} />
              </div>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8, marginBottom: 12 }}>
              {[["★ "+( listing.seller?.rating?.average?.toFixed(1) || "0.0"),"Rating"],[listing.seller?.trustScore || 60,"Trust"]].map(([v, l]) => (
                <div key={l} style={{ background: "#f8fafc", borderRadius: 8, padding: "8px 4px", textAlign: "center" }}>
                  <p style={{ margin: 0, fontSize: 15, fontWeight: 700, color: C.text }}>{v}</p>
                  <p style={{ margin: 0, fontSize: 10, color: C.muted }}>{l}</p>
                </div>
              ))}
            </div>
            <button onClick={() => setPage("chats")} style={{ width: "100%", padding: "10px", background: C.primary, color: "#fff", border: "none", borderRadius: 10, fontWeight: 600, fontSize: 14, cursor: "pointer" }}>
              💬 Chat with Seller
            </button>
          </div>
          <div style={{ background: "#fffbeb", border: "1px solid #fde68a", borderRadius: 12, padding: 14 }}>
            <p style={{ margin: "0 0 6px", fontSize: 13, fontWeight: 600, color: "#92400e" }}>Safety Tips</p>
            <ul style={{ margin: 0, padding: "0 0 0 14px", fontSize: 12, color: "#b45309", lineHeight: 1.8 }}>
              <li>Meet in a public place on campus</li>
              <li>Inspect item before payment</li>
              <li>Use UPI — avoid cash if possible</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Create Listing ────────────────────────
function CreateListingPage({ setPage }) {
  const [form, setForm] = useState({ title: "", description: "", price: "", category: "Electronics", condition: "Good", location: "", negotiable: true, isUrgent: false });
  const [tags, setTags] = useState("");
  const [images, setImages] = useState([]);
  const [imagePreviews, setImagePreviews] = useState([]);
  const [aiLoad, setAiLoad] = useState({ desc: false, price: false, tags: false });
  const [priceSug, setPriceSug] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [spamWarning, setSpamWarning] = useState(null);

  const setF = (key, val) => setForm(f => ({ ...f, [key]: val }));

  const callAI = async (type) => {
    setAiLoad(l => ({ ...l, [type]: true }));
    try {
      if (type === "desc") {
        const r = await aiAPI.generateDescription({ title: form.title, category: form.category, condition: form.condition });
        setF("description", r.data.description);
      } else if (type === "price") {
        const r = await aiAPI.suggestPrice({ title: form.title, category: form.category, condition: form.condition });
        setPriceSug(r.data);
      } else if (type === "tags") {
        const r = await aiAPI.generateTags({ title: form.title, description: form.description, category: form.category });
        setTags(r.data.tags?.join(", ") || "");
      }
    } catch (e) {
      alert("AI feature unavailable. Check that GEMINI_API_KEY is set in your backend .env");
    }
    setAiLoad(l => ({ ...l, [type]: false }));
  };

  const handleImages = (e) => {
    const files = Array.from(e.target.files).slice(0, 6 - images.length);
    setImages(prev => [...prev, ...files].slice(0, 6));
    setImagePreviews(prev => [...prev, ...files.map(f => URL.createObjectURL(f))].slice(0, 6));
  };

  const handleSubmit = async () => {
    if (!form.title || !form.description || !form.price) return alert("Title, description and price are required.");
    setSubmitting(true);

    // Spam check before submitting
    try {
      const spam = await aiAPI.detectSpam({ title: form.title, description: form.description, price: form.price, category: form.category });
      if (spam.data.isSpam) {
        setSpamWarning(spam.data);
        setSubmitting(false);
        return;
      }
    } catch { /* proceed even if spam check fails */ }

    const fd = new FormData();
    Object.entries(form).forEach(([k, v]) => fd.append(k, v));
    fd.append("tags", JSON.stringify(tags.split(",").map(t => t.trim()).filter(Boolean)));
    images.forEach(img => fd.append("images", img));

    try {
      await listingsAPI.create(fd);
      setPage("my-listings");
    } catch (e) {
      alert(e.response?.data?.error || "Failed to create listing");
    }
    setSubmitting(false);
  };

  return (
    <div style={{ maxWidth: 780, margin: "0 auto", padding: "24px 20px" }}>
      <h1 style={{ margin: "0 0 4px", fontSize: 22, fontWeight: 700 }}>Create a Listing</h1>
      <p style={{ margin: "0 0 24px", fontSize: 14, color: C.muted }}>Visible only to your college community</p>

      {spamWarning && (
        <div style={{ background: "#fef2f2", border: "1px solid #fecaca", borderRadius: 10, padding: 14, marginBottom: 16 }}>
          <p style={{ margin: "0 0 6px", fontWeight: 600, color: "#dc2626", fontSize: 14 }}>⚠ AI Flagged This Listing</p>
          <p style={{ margin: "0 0 8px", fontSize: 13, color: "#b91c1c" }}>Spam Score: {spamWarning.spamScore}/100 · {spamWarning.flags?.join(", ")}</p>
          <p style={{ margin: "0 0 10px", fontSize: 13, color: "#b91c1c" }}>{spamWarning.recommendation}</p>
          <button onClick={() => { setSpamWarning(null); }} style={{ marginRight: 8, padding: "6px 12px", background: "none", border: "1px solid #fecaca", borderRadius: 8, cursor: "pointer", fontSize: 12 }}>Edit Listing</button>
          <button onClick={async () => { setSpamWarning(null); setSubmitting(true); const fd = new FormData(); Object.entries(form).forEach(([k,v]) => fd.append(k, v)); fd.append("tags", JSON.stringify(tags.split(",").map(t=>t.trim()))); images.forEach(img => fd.append("images", img)); try { await listingsAPI.create(fd); setPage("my-listings"); } catch(e) { alert(e.message); } setSubmitting(false); }} style={{ padding: "6px 12px", background: "#dc2626", color: "#fff", border: "none", borderRadius: 8, cursor: "pointer", fontSize: 12 }}>Post Anyway</button>
        </div>
      )}

      <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
        {/* Photos */}
        <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 12, padding: 20 }}>
          <p style={{ margin: "0 0 12px", fontWeight: 600, fontSize: 14 }}>Photos <span style={{ color: C.light, fontWeight: 400 }}>(up to 6)</span></p>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(6, 1fr)", gap: 8 }}>
            {imagePreviews.map((url, i) => (
              <div key={i} style={{ position: "relative" }}>
                <img src={url} alt="" style={{ width: "100%", aspectRatio: "1", objectFit: "cover", borderRadius: 8, border: `1px solid ${C.border}` }} />
                {i === 0 && <span style={{ position: "absolute", bottom: 3, left: 3, background: "rgba(0,0,0,0.6)", color: "#fff", fontSize: 9, padding: "2px 5px", borderRadius: 4 }}>Cover</span>}
                <button onClick={() => { setImages(im => im.filter((_, j) => j !== i)); setImagePreviews(p => p.filter((_, j) => j !== i)); }} style={{ position: "absolute", top: -6, right: -6, background: "#ef4444", color: "#fff", border: "none", borderRadius: "50%", width: 18, height: 18, cursor: "pointer", fontSize: 10 }}>✕</button>
              </div>
            ))}
            {imagePreviews.length < 6 && (
              <label style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", aspectRatio: "1", border: `2px dashed ${C.border}`, borderRadius: 8, cursor: "pointer", color: C.light, fontSize: 12, gap: 4 }}>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
                Add
                <input type="file" multiple accept="image/*" onChange={handleImages} style={{ display: "none" }} />
              </label>
            )}
          </div>
        </div>

        {/* Title */}
        <div>
          <label style={{ fontSize: 13, fontWeight: 500, display: "block", marginBottom: 6 }}>Title</label>
          <input value={form.title} onChange={e => setF("title", e.target.value)} placeholder="e.g. MacBook Air M1 2020" style={{ width: "100%", padding: "10px 14px", border: `1px solid ${C.border}`, borderRadius: 10, fontSize: 14, outline: "none", boxSizing: "border-box" }} />
        </div>

        {/* Description */}
        <div>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
            <label style={{ fontSize: 13, fontWeight: 500 }}>Description</label>
            <AIButton label="AI Generate" loading={aiLoad.desc} onClick={() => callAI("desc")} />
          </div>
          <textarea value={form.description} onChange={e => setF("description", e.target.value)} placeholder="Describe the item — condition, accessories, reason for selling..." rows={5} style={{ width: "100%", padding: "10px 14px", border: `1px solid ${C.border}`, borderRadius: 10, fontSize: 14, outline: "none", boxSizing: "border-box", resize: "vertical" }} />
        </div>

        {/* Price + Category */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
          <div>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
              <label style={{ fontSize: 13, fontWeight: 500 }}>Price (₹)</label>
              <AIButton label="Suggest" loading={aiLoad.price} onClick={() => callAI("price")} />
            </div>
            <input type="number" value={form.price} onChange={e => setF("price", e.target.value)} placeholder="0" style={{ width: "100%", padding: "10px 14px", border: `1px solid ${C.border}`, borderRadius: 10, fontSize: 14, outline: "none", boxSizing: "border-box" }} />
            {priceSug && (
              <div style={{ marginTop: 8, background: "#f0fdf4", border: "1px solid #bbf7d0", borderRadius: 8, padding: 10 }}>
                <p style={{ margin: "0 0 6px", fontSize: 12, fontWeight: 600, color: "#15803d" }}>AI Price Suggestion</p>
                <div style={{ display: "flex", gap: 8, marginBottom: 6 }}>
                  {[["Min", priceSug.min],["Best", priceSug.suggested],["Max", priceSug.max]].map(([l, v]) => (
                    <div key={l} style={{ flex: 1, textAlign: "center" }}>
                      <p style={{ margin: 0, fontSize: 10, color: "#15803d" }}>{l}</p>
                      <p style={{ margin: 0, fontSize: 13, fontWeight: 700, color: "#14532d" }}>₹{v?.toLocaleString("en-IN")}</p>
                    </div>
                  ))}
                </div>
                <p style={{ margin: "0 0 8px", fontSize: 11, color: "#166534" }}>{priceSug.reasoning}</p>
                <button onClick={() => setF("price", String(priceSug.suggested))} style={{ width: "100%", padding: 6, background: "#15803d", color: "#fff", border: "none", borderRadius: 6, fontSize: 12, cursor: "pointer" }}>Apply ₹{priceSug.suggested?.toLocaleString("en-IN")}</button>
              </div>
            )}
          </div>
          <div>
            <label style={{ fontSize: 13, fontWeight: 500, display: "block", marginBottom: 6 }}>Category</label>
            <select value={form.category} onChange={e => setF("category", e.target.value)} style={{ width: "100%", padding: "10px 14px", border: `1px solid ${C.border}`, borderRadius: 10, fontSize: 14, outline: "none", boxSizing: "border-box" }}>
              {CATEGORIES.map(c => <option key={c}>{c}</option>)}
            </select>
          </div>
          <div>
            <label style={{ fontSize: 13, fontWeight: 500, display: "block", marginBottom: 6 }}>Condition</label>
            <select value={form.condition} onChange={e => setF("condition", e.target.value)} style={{ width: "100%", padding: "10px 14px", border: `1px solid ${C.border}`, borderRadius: 10, fontSize: 14, outline: "none", boxSizing: "border-box" }}>
              {["New","Like New","Good","Fair","Poor"].map(c => <option key={c}>{c}</option>)}
            </select>
          </div>
          <div>
            <label style={{ fontSize: 13, fontWeight: 500, display: "block", marginBottom: 6 }}>Location on campus</label>
            <input value={form.location} onChange={e => setF("location", e.target.value)} placeholder="e.g. Block C Hostel" style={{ width: "100%", padding: "10px 14px", border: `1px solid ${C.border}`, borderRadius: 10, fontSize: 14, outline: "none", boxSizing: "border-box" }} />
          </div>
        </div>

        {/* Tags */}
        <div>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
            <label style={{ fontSize: 13, fontWeight: 500 }}>Tags</label>
            <AIButton label="AI Tags" loading={aiLoad.tags} onClick={() => callAI("tags")} />
          </div>
          <input value={tags} onChange={e => setTags(e.target.value)} placeholder="laptop, apple, macbook (comma separated)" style={{ width: "100%", padding: "10px 14px", border: `1px solid ${C.border}`, borderRadius: 10, fontSize: 14, outline: "none", boxSizing: "border-box" }} />
        </div>

        {/* Checkboxes */}
        <div style={{ display: "flex", gap: 20 }}>
          {[["negotiable","Price negotiable"],["isUrgent","Urgent sale"]].map(([k, l]) => (
            <label key={k} style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer", fontSize: 13 }}>
              <input type="checkbox" checked={form[k]} onChange={e => setF(k, e.target.checked)} /> {l}
            </label>
          ))}
        </div>

        {/* Submit */}
        <div style={{ display: "flex", gap: 10 }}>
          <button onClick={() => setPage("home")} style={{ flex: 1, padding: 12, border: `1px solid ${C.border}`, borderRadius: 10, background: "none", fontSize: 14, cursor: "pointer" }}>Cancel</button>
          <button onClick={handleSubmit} disabled={submitting} style={{ flex: 2, padding: 12, background: submitting ? "#93c5fd" : C.primary, color: "#fff", border: "none", borderRadius: 10, fontSize: 14, fontWeight: 600, cursor: submitting ? "not-allowed" : "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}>
            {submitting ? <><Spinner size={16} /> Posting...</> : "Post Listing"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Chat Page ─────────────────────────────
function ChatPage() {
  const { user } = useAuth();
  const [chats, setChats] = useState([]);
  const [active, setActive] = useState(null);
  const [input, setInput] = useState("");
  const [typing, setTyping] = useState(false);
  const [aiResponse, setAiResponse] = useState("");
  const [aiLoading, setAiLoading] = useState(false);
  const msgEnd = useRef(null);
  const socketRef = useRef(null);

  useEffect(() => {
    chatsAPI.getAll().then(r => { setChats(r.data); if (r.data.length) setActive(r.data[0]); }).catch(() => {});
  }, []);

  useEffect(() => {
    const token = localStorage.getItem("token");
    const socket = io(import.meta.env.VITE_API_URL || "http://localhost:5000", { auth: { token } });
    socketRef.current = socket;
    socket.on("new_message", ({ chatId, message }) => {
      if (active && String(chatId) === String(active._id)) {
        setActive(a => ({ ...a, messages: [...(a?.messages || []), message] }));
      }
    });
    socket.on("typing_start", ({ chatId }) => { if (active && String(chatId) === String(active._id)) setTyping(true); });
    socket.on("typing_stop", ({ chatId }) => { if (active && String(chatId) === String(active._id)) setTyping(false); });
    return () => socket.disconnect();
  }, [active?._id]);

  const openChat = async (chat) => {
    const r = await chatsAPI.getOne(chat._id);
    setActive(r.data);
    socketRef.current?.emit("join_chat", { chatId: chat._id });
    setAiResponse("");
  };

  const send = async () => {
    if (!input.trim() || !active) return;
    const txt = input;
    setInput("");
    try {
      const r = await chatsAPI.send(active._id, { text: txt });
      setActive(a => ({ ...a, messages: [...(a?.messages || []), r.data] }));
      setTimeout(() => msgEnd.current?.scrollIntoView({ behavior: "smooth" }), 50);
    } catch { alert("Failed to send message"); }
  };

  const askAI = async () => {
    if (!active) return;
    setAiLoading(true);
    try {
      const r = await aiAPI.assistant({
        message: `Give me a smart reply suggestion for a marketplace negotiation. The other person's last message was: "${active.messages?.slice(-1)[0]?.text || ""}"`,
        listingContext: active.listing ? { title: active.listing.title, price: active.listing.price, condition: active.listing.condition, seller: "" } : null,
      });
      setAiResponse(r.data.response);
    } catch { setAiResponse("AI unavailable — check your backend."); }
    setAiLoading(false);
  };

  const me = user?._id;

  return (
    <div style={{ maxWidth: 1100, margin: "0 auto", padding: "20px", height: "calc(100vh - 130px)", display: "flex", gap: 16 }}>
      {/* Sidebar */}
      <div style={{ width: 280, background: C.surface, border: `1px solid ${C.border}`, borderRadius: 12, display: "flex", flexDirection: "column", overflow: "hidden" }}>
        <div style={{ padding: "14px 16px", borderBottom: `1px solid ${C.border}` }}>
          <p style={{ margin: 0, fontWeight: 600, fontSize: 15 }}>Messages</p>
        </div>
        <div style={{ flex: 1, overflowY: "auto" }}>
          {chats.map(c => {
            const other = c.participants?.find(p => String(p._id) !== String(me));
            return (
              <div key={c._id} onClick={() => openChat(c)} style={{ padding: "12px 14px", display: "flex", gap: 10, alignItems: "start", background: active?._id === c._id ? "#eff6ff" : "transparent", borderBottom: `1px solid ${C.border}`, cursor: "pointer" }}>
                <Avatar name={other?.name} pic={other?.profilePic} size={40} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: "flex", justifyContent: "space-between" }}>
                    <p style={{ margin: 0, fontWeight: 600, fontSize: 13 }}>{other?.name}</p>
                    {c.unreadCount > 0 && <span style={{ background: C.primary, color: "#fff", borderRadius: "50%", fontSize: 10, fontWeight: 700, width: 18, height: 18, display: "flex", alignItems: "center", justifyContent: "center" }}>{c.unreadCount}</span>}
                  </div>
                  <p style={{ margin: "2px 0 0", fontSize: 11, color: C.light, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>Re: {c.listing?.title}</p>
                  <p style={{ margin: 0, fontSize: 12, color: C.muted, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{c.lastMessage?.text || "Start a conversation"}</p>
                </div>
              </div>
            );
          })}
          {chats.length === 0 && <p style={{ padding: 20, textAlign: "center", color: C.muted, fontSize: 13 }}>No conversations yet</p>}
        </div>
      </div>

      {/* Main chat */}
      <div style={{ flex: 1, background: C.surface, border: `1px solid ${C.border}`, borderRadius: 12, display: "flex", flexDirection: "column", overflow: "hidden" }}>
        {active ? <>
          {/* Header */}
          <div style={{ padding: "12px 16px", borderBottom: `1px solid ${C.border}`, display: "flex", alignItems: "center", gap: 12 }}>
            {(() => { const other = active.participants?.find(p => String(p._id) !== String(me)); return <><Avatar name={other?.name} pic={other?.profilePic} size={38} /><div><p style={{ margin: 0, fontWeight: 600, fontSize: 14 }}>{other?.name}</p><p style={{ margin: 0, fontSize: 11, color: "#22c55e" }}>Online</p></div></>; })()}
            {active.listing && (
              <div style={{ marginLeft: "auto", background: "#f8fafc", border: `1px solid ${C.border}`, borderRadius: 8, padding: "6px 10px", display: "flex", gap: 8, alignItems: "center" }}>
                <img src={active.listing.images?.[0]?.url} alt="" style={{ width: 28, height: 28, borderRadius: 4, objectFit: "cover" }} />
                <div>
                  <p style={{ margin: 0, fontSize: 11, fontWeight: 500 }}>{active.listing.title}</p>
                  <p style={{ margin: 0, fontSize: 11, color: C.primary }}>₹{active.listing.price?.toLocaleString("en-IN")}</p>
                </div>
              </div>
            )}
          </div>

          {/* Messages */}
          <div style={{ flex: 1, overflowY: "auto", padding: 16, display: "flex", flexDirection: "column", gap: 10, background: "#f8fafc" }}>
            {(active.messages || []).map((m, i) => {
              const isMe = String(m.sender?._id || m.sender) === String(me);
              return (
                <div key={i} style={{ display: "flex", justifyContent: isMe ? "flex-end" : "flex-start", gap: 8, alignItems: "end" }}>
                  {!isMe && <Avatar name={active.participants?.find(p => String(p._id) !== String(me))?.name} size={28} />}
                  <div style={{ maxWidth: "65%" }}>
                    <div style={{ background: isMe ? C.primary : "#fff", color: isMe ? "#fff" : C.text, padding: "10px 14px", borderRadius: isMe ? "16px 16px 4px 16px" : "16px 16px 16px 4px", fontSize: 13.5, lineHeight: 1.5, border: !isMe ? `1px solid ${C.border}` : "none" }}>
                      {m.text}
                    </div>
                    <p style={{ margin: "3px 0 0", fontSize: 10, color: C.light, textAlign: isMe ? "right" : "left" }}>{new Date(m.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</p>
                  </div>
                </div>
              );
            })}
            {typing && (
              <div style={{ display: "flex", gap: 8 }}>
                <div style={{ background: "#fff", border: `1px solid ${C.border}`, padding: "10px 14px", borderRadius: "16px 16px 16px 4px", display: "flex", gap: 4 }}>
                  {[0,1,2].map(i => <div key={i} style={{ width: 6, height: 6, borderRadius: "50%", background: C.light, animation: "pulse 1s ease-in-out infinite", animationDelay: `${i*0.2}s` }} />)}
                </div>
              </div>
            )}
            <div ref={msgEnd} />
          </div>

          {/* AI Reply Suggestion */}
          <div style={{ padding: "8px 16px", borderTop: `1px solid ${C.border}`, background: "#f8fafc" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <span style={{ fontSize: 12, color: C.muted }}>✦ AI can suggest a smart reply</span>
              <AIButton label="Suggest Reply" loading={aiLoading} onClick={askAI} />
            </div>
            {aiResponse && (
              <div style={{ marginTop: 6, background: "#eff6ff", borderRadius: 8, padding: "8px 10px", display: "flex", gap: 8, alignItems: "center" }}>
                <p style={{ margin: 0, flex: 1, fontSize: 13, color: "#1e40af" }}>{aiResponse}</p>
                <button onClick={() => { setInput(aiResponse); setAiResponse(""); }} style={{ background: C.primary, color: "#fff", border: "none", borderRadius: 6, padding: "4px 10px", fontSize: 11, cursor: "pointer" }}>Use</button>
              </div>
            )}
          </div>

          {/* Input */}
          <div style={{ padding: "12px 16px", borderTop: `1px solid ${C.border}`, display: "flex", gap: 10 }}>
            <input value={input} onChange={e => setInput(e.target.value)} onKeyDown={e => e.key === "Enter" && send()} placeholder="Type a message..." style={{ flex: 1, padding: "10px 14px", border: `1px solid ${C.border}`, borderRadius: 22, fontSize: 14, outline: "none" }} />
            <button onClick={send} style={{ width: 42, height: 42, background: C.primary, border: "none", borderRadius: "50%", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.5"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg>
            </button>
          </div>
        </> : (
          <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", color: C.muted, fontSize: 14 }}>
            Select a conversation to start chatting
          </div>
        )}
      </div>
    </div>
  );
}

// ── My Listings ───────────────────────────
function MyListingsPage({ setPage }) {
  const { user } = useAuth();
  const [listings, setListings] = useState([]);
  const [filter, setFilter] = useState("all");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    listingsAPI.getAll({ seller: user?._id, limit: 50 })
      .then(r => setListings(r.data.listings || []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [user?._id]);

  const del = async (id) => {
    if (!window.confirm("Delete this listing?")) return;
    await listingsAPI.delete(id);
    setListings(ls => ls.filter(l => l._id !== id));
  };

  const toggleSold = async (id) => {
    const r = await listingsAPI.toggleSold(id);
    setListings(ls => ls.map(l => l._id === id ? { ...l, status: r.data.status } : l));
  };

  const filtered = filter === "all" ? listings : listings.filter(l => l.status === filter);

  return (
    <div style={{ maxWidth: 900, margin: "0 auto", padding: "24px 20px" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
        <h1 style={{ margin: 0, fontSize: 22, fontWeight: 700 }}>My Listings</h1>
        <button onClick={() => setPage("create")} style={{ background: C.primary, color: "#fff", border: "none", borderRadius: 10, padding: "9px 16px", fontSize: 13, fontWeight: 600, cursor: "pointer" }}>+ New Listing</button>
      </div>
      <div style={{ display: "flex", gap: 8, marginBottom: 20 }}>
        {[["all","All"],["available","Active"],["sold","Sold"]].map(([k, l]) => (
          <button key={k} onClick={() => setFilter(k)} style={{ padding: "7px 16px", borderRadius: 20, border: `1px solid ${filter === k ? C.primary : C.border}`, background: filter === k ? C.primary : "white", color: filter === k ? "#fff" : C.muted, fontSize: 13, cursor: "pointer" }}>
            {l} ({listings.filter(x => k === "all" || x.status === k).length})
          </button>
        ))}
      </div>
      {loading ? <p style={{ textAlign: "center", color: C.muted }}>Loading...</p> : (
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {filtered.map(l => (
            <div key={l._id} style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 12, padding: 14, display: "flex", gap: 14, alignItems: "center" }}>
              <img src={l.images?.[0]?.url || ""} alt="" style={{ width: 80, height: 60, objectFit: "cover", borderRadius: 8, background: "#f1f5f9" }} />
              <div style={{ flex: 1 }}>
                <div style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 4 }}>
                  <p style={{ margin: 0, fontWeight: 600, fontSize: 14 }}>{l.title}</p>
                  <Badge color={l.status === "available" ? "green" : "default"}>{l.status}</Badge>
                </div>
                <div style={{ display: "flex", gap: 16 }}>
                  <span style={{ fontSize: 16, fontWeight: 700, color: C.primary }}>₹{l.price?.toLocaleString("en-IN")}</span>
                  <span style={{ fontSize: 12, color: C.muted }}>{l.views} views</span>
                </div>
              </div>
              <div style={{ display: "flex", gap: 8 }}>
                <button onClick={() => toggleSold(l._id)} style={{ padding: "7px 12px", border: `1px solid ${C.border}`, borderRadius: 8, background: "none", cursor: "pointer", fontSize: 12 }}>
                  {l.status === "available" ? "Mark Sold" : "Relist"}
                </button>
                <button onClick={() => del(l._id)} style={{ padding: "7px 12px", border: "1px solid #fecaca", borderRadius: 8, background: "#fef2f2", cursor: "pointer", fontSize: 12, color: "#dc2626" }}>Delete</button>
              </div>
            </div>
          ))}
          {filtered.length === 0 && <p style={{ textAlign: "center", color: C.muted, padding: "40px 0" }}>No {filter} listings yet.</p>}
        </div>
      )}
    </div>
  );
}

// ── Wishlist ──────────────────────────────
function WishlistPage({ setPage, setSelectedListing }) {
  const [items, setItems] = useState([]);
  useEffect(() => { usersAPI.getWishlist().then(r => setItems(r.data)).catch(() => {}); }, []);
  const remove = async (id) => { await listingsAPI.toggleWishlist(id); setItems(ls => ls.filter(l => l._id !== id)); };
  return (
    <div style={{ maxWidth: 1100, margin: "0 auto", padding: "24px 20px" }}>
      <h1 style={{ margin: "0 0 6px", fontSize: 22, fontWeight: 700 }}>Wishlist</h1>
      <p style={{ margin: "0 0 20px", fontSize: 14, color: C.muted }}>{items.length} saved</p>
      {items.length === 0 ? (
        <div style={{ textAlign: "center", padding: "80px 20px" }}>
          <p style={{ color: C.muted, marginBottom: 16 }}>Nothing saved yet</p>
          <button onClick={() => setPage("home")} style={{ background: C.primary, color: "#fff", border: "none", borderRadius: 10, padding: "10px 20px", fontSize: 14, cursor: "pointer" }}>Browse Listings</button>
        </div>
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(240px, 1fr))", gap: 16 }}>
          {items.map(l => <ListingCard key={l._id} listing={{ ...l, wishlisted: true }} onClick={l => { setSelectedListing(l); setPage("listing-detail"); }} onWishlist={remove} />)}
        </div>
      )}
    </div>
  );
}

// ── Profile ───────────────────────────────
function ProfilePage() {
  const { user } = useAuth();
  const [editing, setEditing] = useState(false);
  const [profile, setProfile] = useState({ bio: user?.bio || "", department: user?.department || "", year: user?.year || "", phone: user?.phone || "" });
  const [saving, setSaving] = useState(false);

  const save = async () => {
    setSaving(true);
    try { await usersAPI.updateProfile(profile); setEditing(false); } catch { alert("Failed to save"); }
    setSaving(false);
  };

  return (
    <div style={{ maxWidth: 900, margin: "0 auto", padding: "24px 20px" }}>
      <div style={{ display: "grid", gridTemplateColumns: "280px 1fr", gap: 20 }}>
        <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 12, padding: 20, textAlign: "center", height: "fit-content" }}>
          <Avatar name={user?.name} pic={user?.profilePic} size={72} />
          <p style={{ margin: "12px 0 2px", fontWeight: 700, fontSize: 17 }}>{user?.name}</p>
          <p style={{ margin: "0 0 6px", fontSize: 13, color: C.muted }}>{user?.email}</p>
          <Badge color="blue">{user?.college?.name || user?.collegeDomain}</Badge>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8, marginTop: 16 }}>
            {[["★ "+(user?.rating?.average?.toFixed(1)||"0.0"),"Rating"],[user?.trustScore||60,"Trust"]].map(([v,l]) => (
              <div key={l} style={{ background: "#f8fafc", borderRadius: 8, padding: "8px 4px" }}>
                <p style={{ margin: 0, fontSize: 15, fontWeight: 700 }}>{v}</p>
                <p style={{ margin: 0, fontSize: 10, color: C.muted }}>{l}</p>
              </div>
            ))}
          </div>
          <div style={{ marginTop: 14 }}>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
              <span style={{ fontSize: 12, color: C.muted }}>Trust Score</span>
              <span style={{ fontSize: 12, fontWeight: 600 }}>{user?.trustScore || 60}/100</span>
            </div>
            <div style={{ background: "#f1f5f9", borderRadius: 10, height: 8, overflow: "hidden" }}>
              <div style={{ width: `${user?.trustScore || 60}%`, height: "100%", background: C.primary, borderRadius: 10 }} />
            </div>
          </div>
        </div>

        <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 12, padding: 20 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
            <p style={{ margin: 0, fontWeight: 600, fontSize: 14 }}>Profile Info</p>
            {editing
              ? <div style={{ display: "flex", gap: 8 }}>
                  <button onClick={() => setEditing(false)} style={{ border: `1px solid ${C.border}`, borderRadius: 8, padding: "5px 12px", fontSize: 12, background: "none", cursor: "pointer" }}>Cancel</button>
                  <button onClick={save} disabled={saving} style={{ background: C.primary, color: "#fff", border: "none", borderRadius: 8, padding: "5px 12px", fontSize: 12, cursor: "pointer" }}>{saving ? "Saving..." : "Save"}</button>
                </div>
              : <button onClick={() => setEditing(true)} style={{ border: `1px solid ${C.border}`, borderRadius: 8, padding: "5px 12px", fontSize: 12, background: "none", cursor: "pointer" }}>Edit</button>
            }
          </div>
          {[["Bio","bio","textarea"],["Department","department","text"],["Year","year","select"],["Phone","phone","text"]].map(([label, key, type]) => (
            <div key={key} style={{ marginBottom: 14 }}>
              <label style={{ fontSize: 12, color: C.muted, display: "block", marginBottom: 4 }}>{label}</label>
              {type === "textarea" ? (
                <textarea value={profile[key]} onChange={e => setProfile(p => ({...p,[key]:e.target.value}))} disabled={!editing} rows={2} style={{ width: "100%", padding: "8px 12px", border: `1px solid ${editing ? C.border : "transparent"}`, borderRadius: 8, fontSize: 13, outline: "none", resize: "none", background: editing ? "white" : "transparent", boxSizing: "border-box" }} />
              ) : type === "select" ? (
                <select value={profile[key]} onChange={e => setProfile(p => ({...p,[key]:e.target.value}))} disabled={!editing} style={{ width: "100%", padding: "8px 12px", border: `1px solid ${editing ? C.border : "transparent"}`, borderRadius: 8, fontSize: 13, outline: "none", background: editing ? "white" : "transparent" }}>
                  <option value="">Select year</option>
                  {["1st","2nd","3rd","4th","Alumni","Staff"].map(y => <option key={y}>{y}</option>)}
                </select>
              ) : (
                <input value={profile[key]} onChange={e => setProfile(p => ({...p,[key]:e.target.value}))} disabled={!editing} style={{ width: "100%", padding: "8px 12px", border: `1px solid ${editing ? C.border : "transparent"}`, borderRadius: 8, fontSize: 13, outline: "none", background: editing ? "white" : "transparent", boxSizing: "border-box" }} />
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ── Login Page ────────────────────────────
function LoginPage() {
  const { login } = useAuth();
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSuccess = async (credentialResponse) => {
    setLoading(true);
    setError("");
    try {
      await login(credentialResponse.credential);
    } catch (e) {
      const msg = e.response?.data?.message || "Login failed. Please try again.";
      setError(msg);
    }
    setLoading(false);
  };

  return (
    <div style={{ minHeight: "100vh", background: "#f8fafc", display: "flex", alignItems: "center", justifyContent: "center" }}>
      <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 16, padding: 40, maxWidth: 400, width: "100%", textAlign: "center", boxShadow: "0 4px 24px rgba(0,0,0,0.08)" }}>
        <div style={{ width: 56, height: 56, borderRadius: 14, background: C.primary, display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 16px" }}>
          <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.5"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>
        </div>
        <h1 style={{ margin: "0 0 6px", fontSize: 24, fontWeight: 800 }}>Campus<span style={{ color: C.primary }}>Market</span></h1>
        <p style={{ margin: "0 0 28px", fontSize: 14, color: C.muted, lineHeight: 1.6 }}>Buy and sell exclusively within your college community.</p>
        <div style={{ background: "#f0fdf4", border: "1px solid #bbf7d0", borderRadius: 10, padding: "10px 14px", marginBottom: 24, textAlign: "left" }}>
          <p style={{ margin: 0, fontSize: 12.5, color: "#15803d" }}>🔒 Sign in with your <strong>college Google account</strong>. Access is automatically restricted to your institution.</p>
        </div>
        {error && (
          <div style={{ background: "#fef2f2", border: "1px solid #fecaca", borderRadius: 8, padding: "10px 14px", marginBottom: 16 }}>
            <p style={{ margin: 0, fontSize: 13, color: "#dc2626" }}>⚠ {error}</p>
          </div>
        )}
        {loading ? (
          <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 10, padding: "12px", border: `1px solid ${C.border}`, borderRadius: 10 }}>
            <Spinner /> <span style={{ fontSize: 14, color: C.muted }}>Signing in...</span>
          </div>
        ) : (
          <GoogleLogin
            onSuccess={handleSuccess}
            onError={() => setError("Google login failed. Please try again.")}
            useOneTap={false}
            width="360"
            text="continue_with"
            shape="rectangular"
            theme="outline"
          />
        )}
        <p style={{ margin: "16px 0 0", fontSize: 12, color: C.light }}>Only college-issued Google accounts are accepted</p>
      </div>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}

// ── Root App ──────────────────────────────
function AppInner() {
  const { user, loading } = useAuth();
  const [page, setPage] = useState("home");
  const [selectedListing, setSelectedListing] = useState(null);

  if (loading) return <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center" }}><Spinner size={32} /></div>;
  if (!user) return <LoginPage />;

  return (
    <div style={{ minHeight: "100vh", background: "#f8fafc", fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif" }}>
      <style>{`
        @keyframes pulse { 0%,100%{opacity:0.4} 50%{opacity:1} }
        @keyframes spin { to { transform: rotate(360deg); } }
        * { box-sizing: border-box; }
        input:focus, select:focus, textarea:focus { border-color: #2563eb !important; box-shadow: 0 0 0 3px rgba(37,99,235,0.12); }
        ::-webkit-scrollbar { width: 5px; height: 5px; }
        ::-webkit-scrollbar-thumb { background: #cbd5e1; border-radius: 10px; }
      `}</style>
      <Navbar page={page} setPage={setPage} />
      {page === "home" && <HomePage setPage={setPage} setSelectedListing={setSelectedListing} />}
      {page === "listing-detail" && <ListingDetailPage listing={selectedListing} setPage={setPage} />}
      {page === "create" && <CreateListingPage setPage={setPage} />}
      {page === "chats" && <ChatPage />}
      {page === "my-listings" && <MyListingsPage setPage={setPage} />}
      {page === "wishlist" && <WishlistPage setPage={setPage} setSelectedListing={setSelectedListing} />}
      {page === "profile" && <ProfilePage />}
    </div>
  );
}

export default function App() {
  return <AuthProvider><AppInner /></AuthProvider>;
}
