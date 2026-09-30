import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Radio } from 'lucide-react';
import { supabase } from '../lib/supabase';

interface LiveRoomsListProps {
  userId: string;
}

// Madde 9: çok sayıda canlı oda olduğunda Explore'daki "Tümünü Gör" bağlantısının
// açtığı ayrı sekme — tüm canlı yayıncı kadınları yuvarlaklar içinde gösterir.
// Aynı paylaşılan presence kanalını (pyngoo_live_rooms_directory) dinler; Explore.tsx'teki
// mantığın birebir aynısı, polling YOK.
export default function LiveRoomsList({ userId }: LiveRoomsListProps) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [rooms, setRooms] = useState<{ id: string; name: string; avatar: string }[]>([]);

  useEffect(() => {
    const dir = supabase.channel('pyngoo_live_rooms_directory');
    const sync = () => {
      const state = dir.presenceState() as Record<string, any[]>;
      const list = Object.entries(state)
        .filter(([id]) => id !== userId)
        .map(([id, presences]) => {
          const p = presences[0] || {};
          return { id, name: p.name || 'Yayıncı', avatar: p.avatar || '' };
        });
      setRooms(list);
    };
    dir.on('presence', { event: 'sync' }, sync);
    dir.subscribe();
    return () => { supabase.removeChannel(dir); };
  }, [userId]);

  return (
    <div style={{ minHeight: '100dvh', background: '#0b0c16', color: '#fff' }}>
      <div style={{
        display: 'flex', alignItems: 'center', gap: 10,
        padding: '14px 16px', borderBottom: '1px solid rgba(255,255,255,0.08)',
        position: 'sticky', top: 0, background: '#0b0c16', zIndex: 2
      }}>
        <button onClick={() => navigate(-1)} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4 }}>
          <ArrowLeft size={20} color="#fff" />
        </button>
        <Radio size={16} color="#ff4d6d" />
        <span style={{ fontSize: '1.05rem', fontWeight: '800' }}>{t('live_rooms_page_title', 'Canlı Sohbet Odaları')}</span>
      </div>

      <div style={{
        padding: '20px 16px', display: 'grid',
        gridTemplateColumns: 'repeat(auto-fill, minmax(76px, 1fr))', gap: '18px'
      }}>
        {rooms.map((room) => (
          <button
            key={room.id}
            onClick={() => navigate(`/room/${room.id}`)}
            style={{
              display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '6px',
              background: 'none', border: 'none', cursor: 'pointer'
            }}
          >
            <div style={{
              width: '68px', height: '68px', borderRadius: '50%', padding: '2.5px',
              background: 'linear-gradient(135deg, #ff2d55, #ff758c)'
            }}>
              <img
                src={room.avatar}
                alt={room.name}
                style={{ width: '100%', height: '100%', borderRadius: '50%', objectFit: 'cover', border: '2px solid #0b0c16' }}
              />
            </div>
            <span style={{ fontSize: '0.68rem', color: 'rgba(255,255,255,0.85)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '76px' }}>
              {room.name}
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}
