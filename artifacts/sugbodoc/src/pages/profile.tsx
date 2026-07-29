import { useState } from 'react';
import AppShell from '@/components/layout/app-shell';
import { useAuth, STORAGE_KEYS } from '@/hooks/use-auth';
import { Bell, Globe, Moon, LogOut, Edit3, HeartPulse, Phone, UserRound } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

type StoredUser = {
  name: string;
  initials: string;
  email: string;
  password?: string;
  phone: string;
  birthday: string;
  gender: string;
  bloodType: string;
};

function loadCurrentUser(): StoredUser | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.CURRENT_USER);
    return raw ? (JSON.parse(raw) as StoredUser) : null;
  } catch {
    return null;
  }
}

export default function Profile() {
  const { logout } = useAuth();
  const { toast } = useToast();
  const [user, setUser] = useState<StoredUser | null>(loadCurrentUser);
  const [isEditing, setIsEditing] = useState(false);
  const [formData, setFormData] = useState<StoredUser | null>(loadCurrentUser);

  // Toggles state
  const [toggles, setToggles] = useState({
    reminders: true,
    labAlerts: true,
    messages: true,
    billing: false,
    darkMode: false
  });

  const handleToggle = (key: keyof typeof toggles) => {
    setToggles(prev => {
      const newState = { ...prev, [key]: !prev[key] };
      
      // Handle dark mode side effect directly for demo
      if (key === 'darkMode') {
        if (newState.darkMode) document.documentElement.classList.add('dark');
        else document.documentElement.classList.remove('dark');
      }

      return newState;
    });
  };

  const handleSaveProfile = (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !formData) return;
    const email = formData.email.trim().toLowerCase();
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      toast({ title: 'Invalid email address', description: 'Please enter a valid email address.', variant: 'destructive' });
      return;
    }

    const users: StoredUser[] = JSON.parse(localStorage.getItem(STORAGE_KEYS.USERS) ?? '[]');
    const duplicate = users.some((candidate) =>
      candidate.email.toLowerCase() === email && candidate.email.toLowerCase() !== user.email.toLowerCase()
    );
    if (duplicate) {
      toast({ title: 'Email already in use', description: 'Another registered account uses that email address.', variant: 'destructive' });
      return;
    }

    const parts = formData.name.trim().split(/\s+/).filter(Boolean);
    const updatedUser: StoredUser = {
      ...formData,
      name: formData.name.trim(),
      email,
      initials: parts.length > 1
        ? `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase()
        : (parts[0]?.slice(0, 2) || 'U').toUpperCase(),
    };
    const updatedUsers = users.map((candidate) =>
      candidate.email.toLowerCase() === user.email.toLowerCase()
        ? { ...candidate, ...updatedUser, password: candidate.password }
        : candidate
    );
    localStorage.setItem(STORAGE_KEYS.USERS, JSON.stringify(updatedUsers));
    localStorage.setItem(STORAGE_KEYS.CURRENT_USER, JSON.stringify(updatedUser));
    setUser(updatedUser);
    setFormData(updatedUser);
    setIsEditing(false);
    toast({
      title: "Profile Updated",
      description: "Your personal information has been successfully saved.",
    });
  };

  if (!user || !formData) {
    return (
      <AppShell title="Profile & Settings">
        <div className="max-w-xl mx-auto rounded-2xl border border-border bg-card p-8 text-center shadow-sm">
          <UserRound className="mx-auto h-10 w-10 text-muted-foreground" />
          <h2 className="mt-4 text-xl font-bold text-foreground">Profile information unavailable</h2>
          <p className="mt-2 text-sm text-muted-foreground">
            No logged-in patient information is available. Please sign in again.
          </p>
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell title="Profile & Settings">
      <div className="max-w-3xl mx-auto space-y-6">
        
        {/* Main Profile Card */}
        <div className="bg-card border border-border rounded-2xl overflow-hidden shadow-sm relative">
          <div className="h-32 bg-gradient-to-r from-primary to-secondary absolute top-0 w-full opacity-90"></div>
          
          <div className="px-6 pt-16 pb-6 relative z-10 flex flex-col sm:flex-row gap-6 items-start sm:items-end">
            <div className="h-24 w-24 rounded-full bg-card p-1 border-4 border-card shadow-lg shrink-0 flex items-center justify-center">
              <div className="h-full w-full rounded-full bg-primary/10 flex items-center justify-center text-3xl font-bold text-primary">
                {user.initials}
              </div>
            </div>
            
            <div className="flex-1 pb-2">
              <h2 className="text-2xl font-bold text-foreground">{user.name}</h2>
              <p className="text-muted-foreground">{user.gender || 'Gender not provided'} • DOB: {user.birthday || 'Birthday not provided'}</p>
            </div>

            <button 
              onClick={() => !isEditing && setIsEditing(true)}
              className="bg-card text-foreground border border-border px-4 py-2 rounded-xl font-medium text-sm hover:bg-muted transition-colors flex items-center gap-2 shadow-sm"
            >
              <Edit3 className="h-4 w-4" />
              {isEditing ? 'Editing...' : 'Edit Profile'}
            </button>
          </div>

          <div className="px-6 pb-6 pt-2">
            {isEditing ? (
              <form onSubmit={handleSaveProfile} className="space-y-4 animate-in fade-in bg-muted/30 p-5 rounded-xl border border-border">
                <div className="grid sm:grid-cols-2 gap-4">
                  <div>
                    <label className="text-xs font-semibold text-muted-foreground mb-1.5 block uppercase tracking-wider">Full Name</label>
                    <input
                      type="text"
                      value={formData.name}
                      onChange={e => setFormData({...formData, name: e.target.value})}
                      className="w-full h-10 px-3 rounded-lg border border-input bg-background focus:ring-2 focus:ring-primary/20 focus:border-primary text-sm"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-semibold text-muted-foreground mb-1.5 block uppercase tracking-wider">Email</label>
                    <input 
                      type="email" 
                      value={formData.email}
                      onChange={e => setFormData({...formData, email: e.target.value})}
                      className="w-full h-10 px-3 rounded-lg border border-input bg-background focus:ring-2 focus:ring-primary/20 focus:border-primary text-sm" 
                    />
                  </div>
                  <div>
                    <label className="text-xs font-semibold text-muted-foreground mb-1.5 block uppercase tracking-wider">Phone Number</label>
                    <input 
                      type="tel" 
                      value={formData.phone}
                      onChange={e => setFormData({...formData, phone: e.target.value})}
                      className="w-full h-10 px-3 rounded-lg border border-input bg-background focus:ring-2 focus:ring-primary/20 focus:border-primary text-sm" 
                    />
                  </div>
                  <div>
                    <label className="text-xs font-semibold text-muted-foreground mb-1.5 block uppercase tracking-wider">Birthday</label>
                    <input
                      type="date"
                      value={formData.birthday}
                      onChange={e => setFormData({...formData, birthday: e.target.value})}
                      className="w-full h-10 px-3 rounded-lg border border-input bg-background focus:ring-2 focus:ring-primary/20 focus:border-primary text-sm"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-semibold text-muted-foreground mb-1.5 block uppercase tracking-wider">Gender</label>
                    <select
                      value={formData.gender}
                      onChange={e => setFormData({...formData, gender: e.target.value})}
                      className="w-full h-10 px-3 rounded-lg border border-input bg-background focus:ring-2 focus:ring-primary/20 focus:border-primary text-sm"
                    >
                      <option value="">Not specified</option>
                      <option>Male</option><option>Female</option><option>Other</option><option>Prefer not to say</option>
                    </select>
                  </div>
                  <div>
                    <label className="text-xs font-semibold text-muted-foreground mb-1.5 block uppercase tracking-wider">Blood Type</label>
                    <input
                      type="text"
                      value={formData.bloodType}
                      onChange={e => setFormData({...formData, bloodType: e.target.value})}
                      className="w-full h-10 px-3 rounded-lg border border-input bg-background focus:ring-2 focus:ring-primary/20 focus:border-primary text-sm"
                    />
                  </div>
                  <div className="sm:col-span-2">
                    <label className="text-xs font-semibold text-muted-foreground mb-1.5 block uppercase tracking-wider">Phone Number</label>
                    <input 
                      type="tel"
                      value={formData.phone}
                      onChange={e => setFormData({...formData, phone: e.target.value})}
                      className="w-full h-10 px-3 rounded-lg border border-input bg-background focus:ring-2 focus:ring-primary/20 focus:border-primary text-sm" 
                    />
                  </div>
                </div>
                <div className="flex justify-end gap-2 pt-2">
                  <button type="button" onClick={() => setIsEditing(false)} className="px-4 py-2 rounded-lg text-sm font-medium hover:bg-background border border-transparent hover:border-border">Cancel</button>
                  <button type="submit" className="px-4 py-2 rounded-lg text-sm font-medium bg-primary text-primary-foreground shadow-sm hover:bg-primary/90">Save Changes</button>
                </div>
              </form>
            ) : (
              <div className="grid sm:grid-cols-2 gap-6 pt-4 border-t border-border mt-4">
                <div className="space-y-4">
                  <div className="flex items-start gap-3">
                    <UserRound className="h-5 w-5 text-primary mt-0.5" />
                    <div>
                      <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Contact Information</p>
                      <p className="font-medium mt-1">{user.email}</p>
                      <p className="text-sm text-muted-foreground mt-1">{user.phone || 'Phone not provided'}</p>
                    </div>
                  </div>
                  <div className="flex items-start gap-3">
                    <HeartPulse className="h-5 w-5 text-destructive mt-0.5" />
                    <div>
                      <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Medical Info</p>
                       <p className="font-medium mt-1">Blood Type: <span className="text-primary font-bold">{user.bloodType || 'Not provided'}</span></p>
                    </div>
                  </div>
                </div>
                <div className="space-y-4">
                  <div className="flex items-start gap-3">
                    <Phone className="h-5 w-5 text-amber-500 mt-0.5" />
                    <div>
                      <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Emergency Contact</p>
                      <p className="font-bold text-foreground mt-1">Phone Number</p>
                      <p className="text-sm font-medium text-muted-foreground">{user.phone || 'Not provided'}</p>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Settings Sections */}
        <div className="grid md:grid-cols-2 gap-6">
          
          {/* Notifications */}
          <div className="bg-card border border-border rounded-2xl p-6 shadow-sm">
            <div className="flex items-center gap-2 mb-6">
              <Bell className="h-5 w-5 text-primary" />
              <h3 className="font-bold text-lg">Notifications</h3>
            </div>
            
            <div className="space-y-5">
              {[
                { id: 'reminders', label: 'Appointment Reminders', desc: 'Get notified 24h before your visit' },
                { id: 'labAlerts', label: 'Lab Result Alerts', desc: 'When new test results are ready' },
                { id: 'messages', label: 'Doctor Messages', desc: 'Direct replies from your care team' },
                { id: 'billing', label: 'Billing Notifications', desc: 'Due dates and payment receipts' }
              ].map(item => (
                <div key={item.id} className="flex items-center justify-between">
                  <div>
                    <p className="font-medium text-foreground text-sm">{item.label}</p>
                    <p className="text-xs text-muted-foreground">{item.desc}</p>
                  </div>
                  <button 
                    onClick={() => handleToggle(item.id as keyof typeof toggles)}
                    className={`w-11 h-6 rounded-full transition-colors relative focus:outline-none focus:ring-2 focus:ring-primary/50 focus:ring-offset-2 focus:ring-offset-card shrink-0 ${toggles[item.id as keyof typeof toggles] ? 'bg-primary' : 'bg-muted-foreground/30'}`}
                  >
                    <span className={`block w-4 h-4 rounded-full bg-white shadow-sm absolute top-1 transition-transform ${toggles[item.id as keyof typeof toggles] ? 'translate-x-6' : 'translate-x-1'}`} />
                  </button>
                </div>
              ))}
            </div>
          </div>

          {/* App Preferences */}
          <div className="bg-card border border-border rounded-2xl p-6 shadow-sm flex flex-col">
            <div className="flex items-center gap-2 mb-6">
              <Globe className="h-5 w-5 text-primary" />
              <h3 className="font-bold text-lg">App Preferences</h3>
            </div>
            
            <div className="space-y-6 flex-1">
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium text-foreground text-sm">Language</p>
                  <p className="text-xs text-muted-foreground">Select preferred interface language</p>
                </div>
                <select className="bg-background border border-input text-sm rounded-lg px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-primary/30">
                  <option>English</option>
                  <option>Filipino</option>
                  <option>Cebuano</option>
                </select>
              </div>

              <div className="flex items-center justify-between">
                <div>
                  <div className="flex items-center gap-2">
                    <Moon className="h-4 w-4 text-muted-foreground" />
                    <p className="font-medium text-foreground text-sm">Dark Mode</p>
                  </div>
                  <p className="text-xs text-muted-foreground">Easier on the eyes in low light</p>
                </div>
                <button 
                  onClick={() => handleToggle('darkMode')}
                  className={`w-11 h-6 rounded-full transition-colors relative focus:outline-none focus:ring-2 focus:ring-primary/50 focus:ring-offset-2 focus:ring-offset-card shrink-0 ${toggles.darkMode ? 'bg-primary' : 'bg-muted-foreground/30'}`}
                >
                  <span className={`block w-4 h-4 rounded-full bg-white shadow-sm absolute top-1 transition-transform ${toggles.darkMode ? 'translate-x-6' : 'translate-x-1'}`} />
                </button>
              </div>
            </div>

            <div className="pt-6 mt-6 border-t border-border">
              <button 
                onClick={logout}
                className="w-full flex items-center justify-center gap-2 py-3 rounded-xl bg-destructive/10 text-destructive font-bold hover:bg-destructive/20 transition-colors"
              >
                <LogOut className="h-5 w-5" />
                Sign Out
              </button>
            </div>
          </div>

        </div>
      </div>
    </AppShell>
  );
}
