'use client';

import { useState } from 'react';

interface Participant {
  id: string;
  name: string;
  likes: number;
  songsPerformed: number;
}

interface ParticipantsManagerProps {
  currentLikes: number;
  onReset?: () => void;
}

export default function ParticipantsManager({ currentLikes, onReset }: ParticipantsManagerProps) {
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [newParticipantName, setNewParticipantName] = useState('');
  const [selectedParticipant, setSelectedParticipant] = useState<string | null>(null);
  const [manualLikes, setManualLikes] = useState('');

  const addParticipant = () => {
    if (!newParticipantName.trim()) return;

    const newParticipant: Participant = {
      id: `participant_${Date.now()}`,
      name: newParticipantName.trim(),
      likes: 0,
      songsPerformed: 0
    };

    setParticipants([...participants, newParticipant]);
    setNewParticipantName('');
  };

  const assignLikesToParticipant = (participantId: string) => {
    setParticipants(participants.map(p => 
      p.id === participantId 
        ? { ...p, likes: p.likes + currentLikes, songsPerformed: p.songsPerformed + 1 }
        : p
    ));
    setSelectedParticipant(participantId);
    
    // Resetear el contador de likes después de asignar
    if (onReset) {
      setTimeout(() => onReset(), 500);
    }
  };

  const removeParticipant = (participantId: string) => {
    setParticipants(participants.filter(p => p.id !== participantId));
  };

  const resetAllScores = () => {
    if (confirm('¿Estás seguro de resetear todos los puntajes?')) {
      setParticipants(participants.map(p => ({ ...p, likes: 0, songsPerformed: 0 })));
      setSelectedParticipant(null);
    }
  };

  // Ordenar participantes por likes (mayor a menor)
  const sortedParticipants = [...participants].sort((a, b) => b.likes - a.likes);

  return (
    <div style={{ 
      background: 'var(--bg2)', 
      border: '1px solid var(--border)', 
      borderRadius: '12px', 
      padding: '16px' 
    }}>
      <div style={{ 
        fontSize: '11px', 
        fontWeight: 800, 
        color: 'var(--text2)', 
        letterSpacing: '.12em', 
        textTransform: 'uppercase', 
        marginBottom: '12px',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center'
      }}>
        <span>🏆 Participantes</span>
        {participants.length > 0 && (
          <button
            onClick={resetAllScores}
            style={{
              background: 'none',
              border: 'none',
              color: 'var(--text2)',
              fontSize: '10px',
              cursor: 'pointer',
              padding: '2px 6px'
            }}
          >
            ↺ Reset
          </button>
        )}
      </div>

      {/* Agregar nuevo participante */}
      <div style={{ marginBottom: '12px' }}>
        <div style={{ display: 'flex', gap: '6px' }}>
          <input
            type="text"
            placeholder="Nombre del participante"
            value={newParticipantName}
            onChange={(e) => setNewParticipantName(e.target.value)}
            onKeyPress={(e) => e.key === 'Enter' && addParticipant()}
            style={{
              flex: 1,
              padding: '8px 10px',
              background: 'var(--bg3)',
              border: '1px solid var(--border)',
              borderRadius: '6px',
              color: 'var(--text)',
              fontSize: '12px',
              fontWeight: 600
            }}
          />
          <button
            onClick={addParticipant}
            style={{
              padding: '8px 14px',
              background: 'linear-gradient(135deg, var(--green), #00c87a)',
              border: 'none',
              borderRadius: '6px',
              color: '#0a0a0f',
              fontSize: '12px',
              fontWeight: 800,
              cursor: 'pointer'
            }}
          >
            +
          </button>
        </div>
      </div>

      {/* Likes actuales para asignar (desde TikTok) */}
      {currentLikes > 0 && participants.length > 0 && (
        <div style={{
          background: 'linear-gradient(135deg, rgba(155, 93, 229, 0.15), rgba(247, 37, 133, 0.15))',
          border: '2px solid rgba(155, 93, 229, 0.4)',
          borderRadius: '10px',
          padding: '12px',
          marginBottom: '12px',
          textAlign: 'center'
        }}>
          <div style={{ fontSize: '10px', color: '#9b5de5', fontWeight: 700, marginBottom: '4px' }}>
            ASIGNAR LIKES (TIKTOK)
          </div>
          <div style={{ fontSize: '20px', fontWeight: 800, color: '#fff', marginBottom: '8px' }}>
            ❤️ {currentLikes.toLocaleString()}
          </div>
          <div style={{ fontSize: '10px', color: 'var(--text2)', marginBottom: '8px' }}>
            Selecciona quién cantó:
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
            {participants.map(p => (
              <button
                key={p.id}
                onClick={() => assignLikesToParticipant(p.id)}
                style={{
                  padding: '6px 10px',
                  background: 'rgba(155, 93, 229, 0.2)',
                  border: '1px solid rgba(155, 93, 229, 0.4)',
                  borderRadius: '6px',
                  color: '#fff',
                  fontSize: '11px',
                  fontWeight: 700,
                  cursor: 'pointer',
                  transition: 'all 0.2s'
                }}
                onMouseOver={(e) => e.currentTarget.style.background = 'rgba(155, 93, 229, 0.4)'}
                onMouseOut={(e) => e.currentTarget.style.background = 'rgba(155, 93, 229, 0.2)'}
              >
                {p.name}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Ingresar likes manualmente */}
      {currentLikes === 0 && participants.length > 0 && (
        <div style={{
          background: 'var(--bg3)',
          border: '1px solid var(--border)',
          borderRadius: '10px',
          padding: '12px',
          marginBottom: '12px'
        }}>
          <div style={{ fontSize: '10px', color: 'var(--text2)', fontWeight: 700, marginBottom: '8px', textTransform: 'uppercase', letterSpacing: '0.1em' }}>
            ✍️ Ingresar Likes Manualmente
          </div>
          <input
            type="number"
            placeholder="Cantidad de likes"
            value={manualLikes}
            onChange={(e) => setManualLikes(e.target.value)}
            style={{
              width: '100%',
              padding: '8px 10px',
              background: 'var(--bg2)',
              border: '1px solid var(--border)',
              borderRadius: '6px',
              color: 'var(--text)',
              fontSize: '13px',
              fontWeight: 600,
              marginBottom: '8px'
            }}
          />
          {manualLikes && parseInt(manualLikes) > 0 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
              <div style={{ fontSize: '10px', color: 'var(--text2)', marginBottom: '4px' }}>
                Asignar {parseInt(manualLikes).toLocaleString()} likes a:
              </div>
              {participants.map(p => (
                <button
                  key={p.id}
                  onClick={() => {
                    const likes = parseInt(manualLikes);
                    if (likes > 0) {
                      setParticipants(participants.map(participant => 
                        participant.id === p.id 
                          ? { ...participant, likes: participant.likes + likes, songsPerformed: participant.songsPerformed + 1 }
                          : participant
                      ));
                      setManualLikes('');
                    }
                  }}
                  style={{
                    padding: '6px 10px',
                    background: 'rgba(0, 245, 160, 0.1)',
                    border: '1px solid rgba(0, 245, 160, 0.3)',
                    borderRadius: '6px',
                    color: 'var(--green)',
                    fontSize: '11px',
                    fontWeight: 700,
                    cursor: 'pointer',
                    transition: 'all 0.2s'
                  }}
                  onMouseOver={(e) => e.currentTarget.style.background = 'rgba(0, 245, 160, 0.2)'}
                  onMouseOut={(e) => e.currentTarget.style.background = 'rgba(0, 245, 160, 0.1)'}
                >
                  {p.name}
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Lista de participantes y ranking */}
      {participants.length === 0 ? (
        <div style={{ 
          textAlign: 'center', 
          color: 'var(--text2)', 
          fontSize: '11px',
          padding: '20px 10px'
        }}>
          Agrega participantes para comenzar
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
          {sortedParticipants.map((participant, index) => (
            <div
              key={participant.id}
              style={{
                background: index === 0 && participant.likes > 0 
                  ? 'linear-gradient(135deg, rgba(255, 215, 0, 0.15), rgba(255, 165, 0, 0.15))'
                  : 'var(--bg3)',
                border: index === 0 && participant.likes > 0
                  ? '1px solid rgba(255, 215, 0, 0.4)'
                  : '1px solid var(--border)',
                borderRadius: '8px',
                padding: '10px 12px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between'
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flex: 1 }}>
                <div style={{ 
                  fontSize: '14px', 
                  fontWeight: 800,
                  color: index === 0 && participant.likes > 0 ? '#ffd700' : 'var(--text2)',
                  minWidth: '20px'
                }}>
                  {index === 0 && participant.likes > 0 ? '👑' : `#${index + 1}`}
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ 
                    fontSize: '13px', 
                    fontWeight: 700, 
                    color: 'var(--text)',
                    marginBottom: '2px'
                  }}>
                    {participant.name}
                  </div>
                  <div style={{ fontSize: '10px', color: 'var(--text2)' }}>
                    {participant.songsPerformed} canción{participant.songsPerformed !== 1 ? 'es' : ''}
                  </div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ 
                    fontSize: '16px', 
                    fontWeight: 800, 
                    color: index === 0 && participant.likes > 0 ? '#ffd700' : '#9b5de5'
                  }}>
                    ❤️ {participant.likes.toLocaleString()}
                  </div>
                </div>
              </div>
              <button
                onClick={() => removeParticipant(participant.id)}
                style={{
                  background: 'none',
                  border: 'none',
                  color: 'var(--text2)',
                  fontSize: '16px',
                  cursor: 'pointer',
                  padding: '4px',
                  marginLeft: '8px',
                  opacity: 0.5
                }}
                onMouseOver={(e) => e.currentTarget.style.opacity = '1'}
                onMouseOut={(e) => e.currentTarget.style.opacity = '0.5'}
              >
                ×
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
