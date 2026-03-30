import React, { useState } from 'react';
import { parseQualitativeToNumber, rankMaterialsForWalls } from '../utils/materialRanking.js';

const scoreBar = (score, color, glow = false) => {
  const numeric = typeof score === 'number' && Number.isFinite(score)
    ? score
    : parseQualitativeToNumber(score, 2);
  const width = `${Math.max(8, Math.min((numeric / 4) * 100, 100))}%`;

  const label = typeof score === 'number' && Number.isFinite(score)
    ? (numeric >= 3.5 ? 'Very High' : numeric >= 2.5 ? 'High' : numeric >= 1.5 ? 'Medium' : 'Low')
    : String(score || '—');

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '0.55rem' }}>
      <div style={{
        width: '102px',
        height: '6px',
        background: 'rgba(255,255,255,0.08)',
        borderRadius: '999px',
        overflow: 'hidden',
        border: '1px solid rgba(255,255,255,0.06)',
      }}>
        <div style={{
          width,
          height: '100%',
          background: color,
          borderRadius: '999px',
          transition: 'width 0.45s ease',
          boxShadow: glow ? `0 0 14px ${color}` : 'none',
        }} />
      </div>
      <span style={{
        color,
        fontSize: '0.84rem',
        fontFamily: "'Courier New', monospace",
        letterSpacing: '0.4px',
        minWidth: '72px',
      }}>
        {label}
      </span>
    </div>
  );
};

const rankBadge = (rank) => {
  const colors = { 1: '#00ffff', 2: '#4a9aba', 3: '#2a5a6a' };
  const labels = { 1: '★ BEST', 2: '2ND', 3: '3RD' };
  return (
    <div style={{
      background: colors[rank] || '#1a2a3a',
      color: rank === 1 ? '#030a14' : '#fff',
      fontSize: '0.74rem',
      fontWeight: 'bold',
      padding: '3px 10px',
      borderRadius: '5px',
      letterSpacing: '1.2px',
      fontFamily: "'Courier New', monospace",
      whiteSpace: 'nowrap',
      boxShadow: rank === 1 ? '0 0 14px rgba(0,255,255,0.4)' : 'none',
    }}>
      {labels[rank] || `#${rank}`}
    </div>
  );
};

function toUiRecommendation(rankedWall) {
  return {
    element_id: rankedWall.wallId,
    element_type: rankedWall.type.toLowerCase(),
    recommendations: rankedWall.materials.map((material) => ({
      name: material.name,
      score: material.score,
      strength_score: material.strength,
      durability_score: material.durability,
      cost_score: material.cost,
    })),
  };
}

function normalizeBackendMaterial(mat) {
  return {
    name: mat?.material || mat?.name || 'Unknown',
    score: typeof mat?.tradeoff_score === 'number' ? mat.tradeoff_score : (typeof mat?.score === 'number' ? mat.score : 0),
    strength_score: mat?.strength_score ?? mat?.strength ?? 0,
    durability_score: mat?.durability_score ?? mat?.durability ?? 0,
    cost_score: mat?.cost_score ?? mat?.cost ?? 0,
  };
}

function normalizeBackendRecommendation(elem) {
  const rawList = Array.isArray(elem?.recommendations)
    ? elem.recommendations
    : (Array.isArray(elem?.ranked_materials) ? elem.ranked_materials : []);

  return {
    element_id: elem?.element_id || elem?.id,
    element_type: elem?.element_type || elem?.type,
    recommendations: rawList.map(normalizeBackendMaterial),
  };
}

export default function MaterialTable({ materialsData, walls = [] }) {
  const [expandedElement, setExpandedElement] = useState(null);
  const { recommendations = [], cost_summary = {}, structural_concerns = [] } = materialsData || {};

  const fallbackByWallId = new Map(
    rankMaterialsForWalls(walls).map((ranked) => [String(ranked.wallId || '').toUpperCase(), toUiRecommendation(ranked)]),
  );

  const computedRecommendations = recommendations.length > 0
    ? recommendations.map((elem) => {
      const normalized = normalizeBackendRecommendation(elem);
      if (normalized.recommendations.length > 0) return normalized;
      const key = String(normalized.element_id || '').toUpperCase();
      return fallbackByWallId.get(key) || normalized;
    })
    : (Array.isArray(walls) && walls.length > 0
      ? rankMaterialsForWalls(walls).map(toUiRecommendation)
      : []);

  return (
    <div style={{
      fontFamily: "'Courier New', monospace",
      color: '#c0d8e0',
      height: '100%',
      overflowY: 'auto',
      padding: '1.5rem',
      background: 'radial-gradient(1200px 420px at -20% -10%, rgba(0,255,255,0.08), transparent 55%)',
    }}>
      <div style={{ color: '#00ffff', fontSize: '0.65rem', letterSpacing: '4px', marginBottom: '1.5rem' }}>
        MATERIAL ANALYSIS & COST–STRENGTH TRADEOFF
      </div>

      {Object.keys(cost_summary).length > 0 && (
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(3, minmax(0, 1fr))',
          gap: '0.75rem',
          marginBottom: '1.5rem',
        }}>
          {Object.entries(cost_summary).map(([key, val]) => (
            <div key={key} style={{
              background: 'rgba(0,255,255,0.04)',
              border: '1px solid rgba(0,255,255,0.15)',
              padding: '0.75rem 1rem',
              borderRadius: '8px',
            }}>
              <div style={{ color: 'rgba(0,255,255,0.55)', fontSize: '0.64rem', letterSpacing: '1.8px', marginBottom: '0.3rem' }}>
                {key.replace(/_/g, ' ').toUpperCase()}
              </div>
              <div style={{ color: '#fff', fontSize: '0.95rem' }}>{val}</div>
            </div>
          ))}
        </div>
      )}

      {structural_concerns.length > 0 && (
        <div style={{ marginBottom: '1.5rem' }}>
          {structural_concerns.map((concern, i) => (
            <div key={i} style={{
              background: 'rgba(255,60,60,0.07)',
              border: '1px solid rgba(255,60,60,0.3)',
              borderLeft: '3px solid #ff3c3c',
              padding: '0.6rem 1rem',
              marginBottom: '0.4rem',
              fontSize: '0.75rem',
              color: '#ff9090',
              letterSpacing: '0.5px',
              borderRadius: '6px',
            }}>
              ⚠ {typeof concern === 'string' ? concern : concern.message || JSON.stringify(concern)}
            </div>
          ))}
        </div>
      )}

      {computedRecommendations.map((elem, idx) => (
        <div key={idx} style={{
          marginBottom: '1.1rem',
          border: '1px solid rgba(0,255,255,0.15)',
          borderRadius: '8px',
          overflow: 'hidden',
          boxShadow: '0 10px 24px rgba(0,0,0,0.22), inset 0 1px 0 rgba(255,255,255,0.03)',
        }}>
          <div
            onClick={() => setExpandedElement(expandedElement === idx ? null : idx)}
            style={{
              background: 'linear-gradient(180deg, rgba(0,255,255,0.06), rgba(0,255,255,0.03))',
              padding: '0.95rem 1rem',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              cursor: 'pointer',
              borderBottom: expandedElement === idx ? '1px solid rgba(0,255,255,0.12)' : 'none',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
              <div style={{
                width: '12px',
                height: '12px',
                background: elem.element_type?.includes('load') ? '#cd853f' : '#00ffff',
                borderRadius: '50%',
                boxShadow: `0 0 14px ${elem.element_type?.includes('load') ? 'rgba(205,133,63,0.55)' : 'rgba(0,255,255,0.45)'}`,
              }} />
              <span style={{ color: '#fff', fontSize: '0.94rem', letterSpacing: '1.1px', fontWeight: 700 }}>
                {(elem.element_id || elem.element_type || `ELEMENT ${idx + 1}`).toString().toUpperCase()}
              </span>
              <span style={{ color: 'rgba(0,255,255,0.58)', fontSize: '0.84rem', letterSpacing: '1px' }}>
                {elem.element_type?.toUpperCase()}
              </span>
            </div>
            <div style={{ color: '#00ffff', fontSize: '0.8rem', opacity: 0.85 }}>
              {expandedElement === idx ? '▲' : '▼'}
            </div>
          </div>

          {expandedElement === idx && (
            <div style={{ overflowX: 'auto' }}>
              <div style={{
                display: 'grid',
                gridTemplateColumns: '72px minmax(220px,1fr) 180px 180px 180px 92px',
                gap: '0.7rem',
                padding: '0.72rem 1rem',
                color: 'rgba(0,255,255,0.44)',
                fontSize: '0.68rem',
                letterSpacing: '2.2px',
                borderBottom: '1px solid rgba(0,255,255,0.08)',
                textTransform: 'uppercase',
                minWidth: '980px',
              }}>
                <div>RANK</div>
                <div>MATERIAL</div>
                <div>STRENGTH</div>
                <div>DURABILITY</div>
                <div>COST</div>
                <div style={{ textAlign: 'right' }}>SCORE</div>
              </div>

              {(elem.recommendations || []).map((mat, mIdx) => (
                <div key={mIdx} style={{
                  display: 'grid',
                  gridTemplateColumns: '72px minmax(220px,1fr) 180px 180px 180px 92px',
                  gap: '0.7rem',
                  padding: '0.95rem 1rem',
                  alignItems: 'center',
                  borderBottom: mIdx < elem.recommendations.length - 1
                    ? '1px solid rgba(0,255,255,0.05)' : 'none',
                  background: mIdx === 0
                    ? 'linear-gradient(90deg, rgba(0,255,255,0.11), rgba(0,255,255,0.02) 42%, rgba(0,255,255,0.01))'
                    : 'transparent',
                  minWidth: '980px',
                }}>
                  <div>{rankBadge(mIdx + 1)}</div>
                  <div style={{
                    color: mIdx === 0 ? '#f4fdff' : '#9ec5cf',
                    fontSize: '1.05rem',
                    lineHeight: 1.1,
                    letterSpacing: '0.7px',
                    fontWeight: mIdx === 0 ? 700 : 500,
                  }}>
                    {mat.material || mat.name}
                  </div>
                  <div>{scoreBar(mat.strength_score ?? mat.strength ?? 0, '#cf8a40', mIdx === 0)}</div>
                  <div>{scoreBar(mat.durability_score ?? mat.durability ?? 0, '#4ea7d0', mIdx === 0)}</div>
                  <div>{scoreBar(mat.cost_score ?? mat.cost ?? 0, '#74ba7b', mIdx === 0)}</div>
                  <div style={{
                    color: mIdx === 0 ? '#1efbff' : '#4a7a8a',
                    fontSize: '1.05rem',
                    fontWeight: mIdx === 0 ? 800 : 500,
                    letterSpacing: '1px',
                    textAlign: 'right',
                  }}>
                    {typeof mat.tradeoff_score === 'number'
                      ? mat.tradeoff_score.toFixed(3)
                      : mat.score?.toFixed(3) || '—'}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      ))}

      {computedRecommendations.length === 0 && (
        <div style={{
          color: 'rgba(0,255,255,0.3)',
          textAlign: 'center',
          padding: '3rem',
          fontSize: '0.8rem',
          letterSpacing: '2px',
        }}>
          NO MATERIAL DATA AVAILABLE
        </div>
      )}
    </div>
  );
}
