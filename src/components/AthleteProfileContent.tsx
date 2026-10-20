import React, { useState } from 'react';
import { Activity, Award, LockKeyhole, MapPin, ShieldCheck, Target, Trophy, TrendingUp } from 'lucide-react';
import type { AthleteProfile } from '../types';
import { ATHLETE_TIERS } from '../services/rankingValidator';
import { athleteSummary } from '../services/athleteSummary';

export function AthleteAvatar({ athlete, photoUrl }: { athlete?: AthleteProfile | null; photoUrl?: string | null }) {
  const [failedUrl, setFailedUrl] = useState<string | null>(null);
  const url = photoUrl || athlete?.photoUrl;
  return <div className="athlete-avatar">{url && url !== failedUrl
    ? <img src={url} alt={athlete?.name || 'Foto do usuário'} referrerPolicy="no-referrer" onError={() => setFailedUrl(url)} />
    : <span>{(athlete?.name || 'A').slice(0, 1).toLocaleUpperCase('pt-BR')}</span>}</div>;
}
const value = (number: number | null | undefined) => number == null ? '—' : number.toLocaleString('pt-BR');
export function AthleteProfileContent({ athlete, ranking = [] }: { athlete: AthleteProfile; ranking?: AthleteProfile[] }) {
  const summary = athleteSummary(athlete);
  const category = ranking.filter(item => item.level === athlete.level);
  const rank = (list: AthleteProfile[]) => list.some(item => item.id === athlete.id) ? 1 + list.filter(item => item.points > athlete.points).length : null;
  const metrics = [
    { label: 'Vitórias', number: summary.wins, detail: `${summary.games} jogos registrados`, icon: Trophy },
    { label: 'Derrotas', number: summary.losses, detail: `Saldo ${summary.wins - summary.losses >= 0 ? '+' : ''}${summary.wins - summary.losses}`, icon: Activity },
    { label: 'Aproveitamento', number: `${summary.winRate}%`, detail: summary.games ? 'Vitórias / jogos disputados' : 'Ainda sem partidas', icon: Target },
    { label: 'Total de títulos', number: summary.titles, detail: 'Campeão · 1º lugar', icon: Trophy },
    { label: 'Total de pódios', number: summary.podiums, detail: 'Colocações no top 3', icon: Award },
    { label: 'Campeonatos', number: summary.tournaments, detail: 'Campanhas registradas', icon: ShieldCheck },
  ];
  const stats = athlete.stats;
  const positive = stats ? stats.aces + stats.sharkAttacks + stats.pingoPoints + stats.defenses : 0;
  const total = positive + (stats?.errors || 0);
  return <div className="athlete-sheet-content">
    <section className="athlete-panel athlete-category-panel" aria-label="Categoria e progressão MMR">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div><p className="athlete-eyebrow">Categoria de jogo</p><h3 className="text-2xl font-black text-white mt-1">{summary.tier.label}</h3></div>
        <div className="text-right"><p className="athlete-eyebrow">MMR atual</p><strong className="text-3xl tabular-nums font-black text-cyan-200">{value(athlete.points)}</strong></div>
      </div>
      <p className="athlete-lock-note"><LockKeyhole size={14} aria-hidden="true" /> Fixada no cadastro · Evolução por MMR</p>
      <div className="athlete-tier-grid">{ATHLETE_TIERS.map((tier, index) => <div key={tier.level} className={`athlete-tier ${tier.level === athlete.level ? 'is-current' : ''} ${index === 4 ? 'last-tier' : ''}`} aria-current={tier.level === athlete.level ? 'step' : undefined}>
        <span className="flex items-center gap-1.5 font-extrabold">{tier.level !== athlete.level && <LockKeyhole size={12} aria-hidden="true" />}{tier.label}</span><span className="tabular-nums text-xs">{tier.minPoints}+ MMR</span>
      </div>)}</div>
      <div className="flex flex-wrap justify-between gap-2 text-xs mt-4"><span>{summary.tier.nextLevel ? 'Progresso na categoria' : 'Categoria máxima'}</span><strong>{summary.promotion.progressPercent}%</strong></div>
      <div className="athlete-mmr-track" role="progressbar" aria-label="Progresso para próxima categoria" aria-valuemin={0} aria-valuemax={100} aria-valuenow={summary.promotion.progressPercent}><span style={{ width: `${summary.promotion.progressPercent}%` }} /></div>
      <p className="text-xs text-slate-300 leading-relaxed mt-2">{summary.promotion.explanation}</p>
    </section>
    <section className="athlete-stat-grid" aria-label="Estatísticas esportivas">{metrics.map(metric => <article className="athlete-metric" key={metric.label}>
      <div className="flex items-start justify-between gap-2"><h3>{metric.label}</h3><metric.icon size={16} aria-hidden="true" /></div>
      <strong>{typeof metric.number === 'string' ? metric.number : value(metric.number)}</strong><p>{metric.detail}</p>
    </article>)}</section>
    <section className="athlete-panel" aria-labelledby="athlete-podium-heading">
      <div className="athlete-section-heading"><Award size={18} aria-hidden="true" /><h3 id="athlete-podium-heading">Pódios & campanhas</h3></div>
      <div className="grid grid-cols-3 gap-2 my-4">{['1º lugar', '2º lugar', '3º lugar'].map((label, index) => <div className={`athlete-medal medal-${index + 1}`} key={label}><span>{label}</span><strong>{summary.campaigns.length || summary.games === 0 ? value(summary.medals[index]) : '—'}</strong></div>)}</div>
      {summary.campaigns.length ? <>
        <div className="space-y-2 sm:hidden">{summary.campaigns.map(campaign => <article className="athlete-campaign-card" key={campaign.tournamentId}><strong>{campaign.tournamentName}</strong><p>{campaign.date} · {campaign.partner || 'Parceiro não informado'}</p><p>{campaign.placement ? `${campaign.placement}º lugar · ` : ''}{campaign.matches} J · {campaign.wins} V · {campaign.losses} D · {value(campaign.mmrGained)} MMR</p></article>)}</div>
        <div className="hidden sm:block overflow-x-auto"><table className="athlete-campaign-table"><caption className="sr-only">Histórico de campeonatos verificados</caption><thead><tr><th>Campeonato / parceiro</th><th>Posição</th><th>J · V · D</th><th>MMR</th></tr></thead><tbody>{summary.campaigns.map(campaign => <tr key={campaign.tournamentId}><td><strong>{campaign.tournamentName}</strong><span>{campaign.date} · {campaign.partner || 'Não informado'}</span></td><td>{campaign.placement ? `${campaign.placement}º` : '—'}</td><td className="whitespace-nowrap tabular-nums">{campaign.matches} · {campaign.wins} · {campaign.losses}</td><td className="tabular-nums">{value(campaign.mmrGained)}</td></tr>)}</tbody></table></div>
      </> : <p className="athlete-empty">Nenhuma campanha oficial detalhada disponível. Pódios manuais e prévias de jogos não entram nesta ficha.</p>}
    </section>
    <section className="athlete-panel" aria-label="Identidade esportiva"><div className="athlete-section-heading"><MapPin size={18} /><h3>Identidade esportiva</h3></div><dl className="athlete-detail-grid">
      <div><dt>Localização</dt><dd>{[athlete.city, athlete.state].filter(Boolean).join(' / ') || 'Não informado'}</dd></div><div><dt>Arena</dt><dd>{athlete.arenaName || 'Não informada'}</dd></div>
      <div><dt>Lado de preferência</dt><dd>{athlete.courtSide || 'Não informado'}</dd></div><div><dt>Pé dominante</dt><dd>{athlete.dominantFoot || 'Não informado'}</dd></div>
      <div><dt>Posição na lista carregada</dt><dd>{rank(ranking) ? `#${rank(ranking)}` : '—'}</dd></div><div><dt>Na categoria carregada</dt><dd>{rank(category) ? `#${rank(category)}` : '—'}</dd></div>
    </dl>{athlete.bio && <p className="text-sm text-slate-200 mt-4 leading-relaxed">{athlete.bio}</p>}</section>
    <section className="athlete-panel" aria-label="Fundamentos técnicos"><div className="athlete-section-heading"><TrendingUp size={18} /><h3>Fundamentos técnicos</h3></div><dl className="athlete-scout-grid">{[
      ['Saques ace', stats?.aces], ['Shark Attacks', stats?.sharkAttacks], ['Pingos', stats?.pingoPoints], ['Defesas', stats?.defenses], ['Erros', stats?.errors],
    ].map(([label, number]) => <div key={String(label)}><dt>{label}</dt><dd>{value(number as number | undefined)}</dd></div>)}<div><dt>Ações positivas</dt><dd>{total ? `${Math.round(positive / total * 100)}%` : '—'}</dd></div></dl><p className="text-xs text-slate-400 mt-3">{stats ? 'Indicador calculado: ações positivas ÷ total de ações registradas.' : 'Nenhum scout técnico registrado para este atleta.'}</p></section>
  </div>;
}
