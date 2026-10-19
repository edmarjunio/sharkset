import jsPDF from 'jspdf';
import { BracketMatch, TeamPair, Tournament, TenantConfig } from '../types';
import { TOURNAMENT_CATEGORY_LABELS } from './rankingValidator';
import { formatMatchResult } from './tournamentRules';

export interface StandingsInputRow {
  position?: number;
  pair?: TeamPair;
  pairId?: string;
  pairName?: string;
  player1?: string;
  player2?: string;
  matchesPlayed: number;
  wins: number;
  losses: number;
  pointsFor: number;
  pointsAgainst: number;
  pointsBalance?: number;
  pointsDiff?: number;
  winRate?: number;
}

export interface PodiumInput {
  champion?: TeamPair;
  runnerUp?: TeamPair;
  thirdPlace?: TeamPair;
  first?: TeamPair;
  second?: TeamPair;
  third?: TeamPair;
  fourth?: TeamPair;
}

function normalizePodium(podium: PodiumInput) {
  return {
    first: podium.first || podium.champion,
    second: podium.second || podium.runnerUp,
    third: podium.third || podium.thirdPlace,
    fourth: podium.fourth,
  };
}

function normalizeStandings(rows: StandingsInputRow[]) {
  return rows.map((r, idx) => {
    const p1 = r.player1 || r.pair?.player1 || 'Atleta 1';
    const p2 = r.player2 || r.pair?.player2 || 'Atleta 2';
    const pairName = r.pairName || (r.pair ? `${r.pair.player1} & ${r.pair.player2}` : `${p1} & ${p2}`);
    const balance = r.pointsBalance ?? r.pointsDiff ?? (r.pointsFor - r.pointsAgainst);
    const wr = r.winRate ?? (r.matchesPlayed > 0 ? (r.wins / r.matchesPlayed) * 100 : 0);
    return {
      position: r.position || idx + 1,
      pairId: r.pairId || r.pair?.id || `pair-${idx}`,
      pairName,
      player1: p1,
      player2: p2,
      matchesPlayed: r.matchesPlayed,
      wins: r.wins,
      losses: r.losses,
      pointsFor: r.pointsFor,
      pointsAgainst: r.pointsAgainst,
      pointsBalance: balance,
      winRate: wr,
    };
  });
}

function sanitizeFileName(name: string): string {
  return name
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9_-]/g, '_')
    .replace(/_+/g, '_')
    .slice(0, 40);
}

/**
 * Exports tournament bracket results to a downloadable CSV file with UTF-8 BOM.
 */
export function exportBracketToCSV(
  tournament: Tournament,
  matches: BracketMatch[],
  standingsInput: StandingsInputRow[],
  podiumInput: PodiumInput,
  tenant: TenantConfig
): void {
  const standings = normalizeStandings(standingsInput);
  const podium = normalizePodium(podiumInput);
  const lines: string[] = [];

  // UTF-8 BOM for Excel / Google Sheets compatibility
  lines.push('\uFEFF');

  // Header / Metadata
  lines.push('RELATÓRIO OFICIAL DE RESULTADOS E CHAVEAMENTO - SHARK SET');
  lines.push(`Torneio:;${tournament.name}`);
  lines.push(`Arena / Local:;${tenant.name} (${tenant.city} - ${tenant.state})`);
  lines.push(`Data:;${tournament.date}`);
  lines.push(`Categoria:;${TOURNAMENT_CATEGORY_LABELS[tournament.category] || tournament.category}`);
  lines.push(`Modalidade:;${tournament.modalityFormat === 'simples' ? 'Simples' : 'Duplas'}`);
  lines.push(`Organizador / Responsável:;${tournament.responsibleName || tenant.ownerName} (${tournament.responsiblePhone || tenant.whatsapp})`);
  lines.push(`Status do Torneio:;${tournament.isFinished ? 'Concluído' : 'Em Andamento'}`);
  lines.push(`Data de Exportação:;${new Date().toLocaleString('pt-BR')}`);
  lines.push('');

  // Podium Section
  lines.push('--- PÓDIO OFICIAL ---');
  lines.push(`1º Lugar (Campeão):;${podium.first ? `${podium.first.player1} & ${podium.first.player2}` : 'Em disputa'}`);
  lines.push(`2º Lugar (Vice-Campeão):;${podium.second ? `${podium.second.player1} & ${podium.second.player2}` : 'Em disputa'}`);
  lines.push(`3º Lugar:;${podium.third ? `${podium.third.player1} & ${podium.third.player2}` : 'Em disputa'}`);
  if (podium.fourth) {
    lines.push(`4º Lugar:;${podium.fourth.player1} & ${podium.fourth.player2}`);
  }
  lines.push('');

  // Standings Section
  lines.push('--- CLASSIFICAÇÃO GERAL & APROVEITAMENTO ---');
  lines.push('Posição;Dupla / Atletas;Jogador 1;Jogador 2;Jogos;Vitórias;Derrotas;Taxa de Vitória (Win Rate %);Pontos Pró;Pontos Contra;Saldo de Pontos');
  standings.forEach((s) => {
    lines.push(
      `${s.position}º;${s.pairName};${s.player1};${s.player2};${s.matchesPlayed};${s.wins};${s.losses};${s.winRate.toFixed(1)}%;${s.pointsFor};${s.pointsAgainst};${s.pointsBalance}`
    );
  });
  lines.push('');

  // Matches Section
  lines.push('--- HISTÓRICO DE PARTIDAS E RESULTADOS DA TABELA ---');
  lines.push('Jogo #;Fase / Chave;Quadra;Horário;Dupla 1;Pontos totais 1;Pontos totais 2;Dupla 2;Vencedor;Status;Sets / W.O.');
  matches.forEach((m) => {
    const stageLabel =
      m.stage === 'winners'
        ? `Vencedores R${m.round}`
        : m.stage === 'losers'
        ? `Repescagem R${m.round}`
        : m.stage === 'semifinals'
        ? 'Semifinal'
        : m.stage === 'grand_final'
        ? 'Grande Final'
        : m.stage === 'super_final'
        ? 'Super Final'
        : m.stage;

    const t1Name = m.team1 ? `${m.team1.player1} & ${m.team1.player2}` : 'A definir';
    const t2Name = m.team2 ? `${m.team2.player1} & ${m.team2.player2}` : 'A definir';
    const winnerTeam = m.winnerId === m.team1?.id ? m.team1 : m.winnerId === m.team2?.id ? m.team2 : undefined;
    const winnerName = winnerTeam ? `${winnerTeam.player1} & ${winnerTeam.player2}` : '-';
    const statusLabel = m.status === 'completed' ? 'Finalizada' : m.status === 'in_progress' ? 'Ao Vivo' : 'Aguardando';

    lines.push(
      `Jogo ${m.matchNumber};${stageLabel};${m.courtName || 'Quadra Principal'};${m.scheduledTime || '-'};${t1Name};${m.score1 ?? '-'};${m.score2 ?? '-'};${t2Name};${winnerName};${statusLabel};${formatMatchResult(m)}`
    );
  });

  const csvContent = lines.join('\n');
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.setAttribute('href', url);
  link.setAttribute('download', `${sanitizeFileName(tournament.name)}_resultados.csv`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

/**
 * Generates and downloads a shareable, formatted PDF document with tournament results and bracket.
 */
export async function exportBracketToPDF(
  tournament: Tournament,
  matches: BracketMatch[],
  standingsInput: StandingsInputRow[],
  podiumInput: PodiumInput,
  tenant: TenantConfig
): Promise<void> {
  const standings = normalizeStandings(standingsInput);
  const podium = normalizePodium(podiumInput);
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4',
  });

  const pageWidth = doc.internal.pageSize.getWidth();
  let currentY = 16;

  const logo = new Image();
  logo.src = '/brand/logo.png';
  await logo.decode();
  function ensureSpace(height: number) {
    if (currentY + height <= 275) return;
    doc.addPage();
    doc.setFillColor(15, 23, 42); doc.rect(10, 10, pageWidth - 20, 15, 'F');
    doc.addImage(logo, 'PNG', 12, 11, 13, 13);
    doc.setTextColor(226, 232, 240); doc.setFontSize(10);
    doc.text('SHARKSET | Continuação do relatório', 29, 19);
    doc.setFontSize(8); doc.setFont('helvetica', 'normal'); currentY = 32;
  }

  // Header Banner
  doc.setFillColor(15, 23, 42); // slate-900
  doc.rect(10, 10, pageWidth - 20, 24, 'F');

  doc.setTextColor(9, 135, 206); // amber-500
  doc.addImage(logo, 'PNG', 14, 12, 20, 20);
  doc.setFontSize(12);
  doc.setFont('helvetica', 'bold');
  doc.text('SHARKSET | RELATÓRIO DO TORNEIO', 38, 20);

  doc.setTextColor(226, 232, 240); // slate-200
  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.text(`${tenant.name} | ${tenant.city} - ${tenant.state} | Data: ${tournament.date}`, 38, 28);

  currentY = 40;

  // Tournament Info Box
  doc.setFillColor(248, 250, 252);
  doc.setDrawColor(203, 213, 225);
  doc.roundedRect(10, currentY, pageWidth - 20, 26, 2, 2, 'FD');

  doc.setTextColor(15, 23, 42);
  doc.setFontSize(12);
  doc.setFont('helvetica', 'bold');
  doc.text(tournament.name, 15, currentY + 7);

  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(71, 85, 105);
  const catLabel = TOURNAMENT_CATEGORY_LABELS[tournament.category] || tournament.category;
  const modLabel = tournament.modalityFormat === 'simples' ? 'Simples' : 'Duplas';
  doc.text(`Categoria: ${catLabel} | Formato: ${modLabel} | Status: ${tournament.isFinished ? 'Concluído' : 'Em Andamento'}`, 15, currentY + 14);
  doc.text(`Responsável: ${tournament.responsibleName || tenant.ownerName} (${tournament.responsiblePhone || tenant.whatsapp}) | Emitido: ${new Date().toLocaleString('pt-BR')}`, 15, currentY + 21);

  currentY += 32;

  // Podium Section
  doc.setFillColor(232, 248, 252); // amber-100
  doc.setDrawColor(9, 135, 206);
  doc.roundedRect(10, currentY, pageWidth - 20, 22, 2, 2, 'FD');

  doc.setTextColor(9, 135, 206);
  doc.setFontSize(11);
  doc.setFont('helvetica', 'bold');
  doc.text('🏆 PÓDIO OFICIAL DO CAMPEONATO', 15, currentY + 6);

  doc.setFontSize(9);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(15, 23, 42);
  const p1Text = podium.first ? `${podium.first.player1} & ${podium.first.player2}` : 'Em disputa';
  const p2Text = podium.second ? `${podium.second.player1} & ${podium.second.player2}` : 'Em disputa';
  const p3Text = podium.third ? `${podium.third.player1} & ${podium.third.player2}` : 'Em disputa';

  doc.text(`1º Lugar: ${p1Text}`, 15, currentY + 13);
  doc.text(`2º Lugar: ${p2Text}`, 85, currentY + 13);
  doc.text(`3º Lugar: ${p3Text}`, 145, currentY + 13);

  currentY += 28;

  // Standings Table
  doc.setFontSize(11);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(15, 23, 42);
  doc.text('Classificação e aproveitamento', 10, currentY);

  currentY += 4;

  // Table Header
  doc.setFillColor(226, 232, 240);
  doc.rect(10, currentY, pageWidth - 20, 7, 'F');
  doc.setFontSize(8);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(51, 65, 85);

  doc.text('Pos', 13, currentY + 5);
  doc.text('Dupla / Atletas', 26, currentY + 5);
  doc.text('Jogos', 98, currentY + 5);
  doc.text('Vitórias', 115, currentY + 5);
  doc.text('Win Rate %', 135, currentY + 5);
  doc.text('Saldo Pts', 165, currentY + 5);

  currentY += 7;

  // Every registered pair is included, across as many pages as necessary.
  doc.setFont('helvetica', 'normal');
  const rowsToPrint = standings;
  rowsToPrint.forEach((row, idx) => {
    ensureSpace(7);
    if (idx % 2 === 1) {
      doc.setFillColor(248, 250, 252);
      doc.rect(10, currentY, pageWidth - 20, 6, 'F');
    }
    doc.setTextColor(15, 23, 42);
    doc.text(`${row.position}º`, 13, currentY + 4.5);
    doc.text(row.pairName.slice(0, 38), 26, currentY + 4.5);
    doc.text(`${row.matchesPlayed}`, 101, currentY + 4.5);
    doc.text(`${row.wins}V - ${row.losses}D`, 116, currentY + 4.5);
    doc.text(`${row.winRate.toFixed(1)}%`, 138, currentY + 4.5);
    doc.text(`${row.pointsBalance > 0 ? '+' : ''}${row.pointsBalance}`, 168, currentY + 4.5);

    currentY += 6;
  });

  currentY += 6;
  ensureSpace(25);

  // Matches Breakdown
  doc.setFontSize(11);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(15, 23, 42);
  doc.text('Partidas e Resultados do Chaveamento', 10, currentY);

  currentY += 4;

  // Matches Header
  doc.setFillColor(226, 232, 240);
  doc.rect(10, currentY, pageWidth - 20, 7, 'F');
  doc.setFontSize(8);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(51, 65, 85);

  doc.text('Jogo', 13, currentY + 5);
  doc.text('Fase', 26, currentY + 5);
  doc.text('Confronto & Placar', 60, currentY + 5);
  doc.text('Vencedor', 140, currentY + 5);

  currentY += 7;

  // Matches Rows (up to available page height)
  doc.setFont('helvetica', 'normal');
  matches.forEach((m, idx) => {
    const t1Name = m.team1 ? `${m.team1.player1} & ${m.team1.player2}` : 'A definir';
    const t2Name = m.team2 ? `${m.team2.player1} & ${m.team2.player2}` : 'A definir';
    const scoreStr = formatMatchResult(m);
    const confrontationLines = doc.splitTextToSize(`${t1Name}\n${scoreStr}\n${t2Name}`, 76);
    const rowHeight = Math.max(16, confrontationLines.length * 4 + 2);
    ensureSpace(rowHeight);

    if (idx % 2 === 1) {
      doc.setFillColor(248, 250, 252);
      doc.rect(10, currentY, pageWidth - 20, rowHeight, 'F');
    }

    const stageLabel =
      m.stage === 'winners'
        ? `Vencedores R${m.round}`
        : m.stage === 'losers'
        ? `Repescagem R${m.round}`
        : m.stage === 'semifinals'
        ? 'Semifinal'
        : m.stage === 'grand_final'
        ? 'Grande Final'
        : m.stage === 'super_final'
        ? 'Super Final'
        : m.stage;

    const winnerTeam = m.winnerId === m.team1?.id ? m.team1 : m.winnerId === m.team2?.id ? m.team2 : undefined;
    const winnerName = winnerTeam ? `${winnerTeam.player1}` : '-';

    doc.setTextColor(15, 23, 42);
    doc.text(`#${m.matchNumber}`, 13, currentY + 4.5);
    doc.text(stageLabel, 26, currentY + 4.5);
    doc.text(confrontationLines, 60, currentY + 4.5);
    doc.text(winnerName.slice(0, 26), 140, currentY + 4.5);

    currentY += rowHeight;
  });

  // Footer
  for (let page = 1; page <= doc.getNumberOfPages(); page++) {
  doc.setPage(page);
  doc.setFontSize(7);
  doc.setTextColor(148, 163, 184);
  doc.text(
    `SHARKSET | Resultados registrados pelo organizador | Página ${page} de ${doc.getNumberOfPages()}`,
    pageWidth / 2,
    290,
    { align: 'center' }
  );
  }

  doc.save(`${sanitizeFileName(tournament.name)}_oficial.pdf`);
}

/**
 * Opens a print-optimized window for instantaneous paper printing or native PDF export.
 */
export function openBracketPrintWindow(
  tournament: Tournament,
  matches: BracketMatch[],
  standingsInput: StandingsInputRow[],
  podiumInput: PodiumInput,
  tenant: TenantConfig
): void {
  // User-entered names and notes must remain text in the generated document.
  const escapeData = <T,>(value: T): T => JSON.parse(JSON.stringify(value), (_key, item) => typeof item === 'string' ? item.replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]!)) : item);
  tournament = escapeData(tournament); matches = escapeData(matches); standingsInput = escapeData(standingsInput); podiumInput = escapeData(podiumInput); tenant = escapeData(tenant);
  const standings = normalizeStandings(standingsInput);
  const podium = normalizePodium(podiumInput);
  const catLabel = TOURNAMENT_CATEGORY_LABELS[tournament.category] || tournament.category;
  const modLabel = tournament.modalityFormat === 'simples' ? 'Simples' : 'Duplas';
  const p1 = podium.first ? `${podium.first.player1} & ${podium.first.player2}` : 'Em disputa';
  const p2 = podium.second ? `${podium.second.player1} & ${podium.second.player2}` : 'Em disputa';
  const p3 = podium.third ? `${podium.third.player1} & ${podium.third.player2}` : 'Em disputa';

  const standingsHtml = standings
    .map(
      (s) => `
    <tr style="border-bottom: 1px solid #e2e8f0; font-size: 13px;">
      <td style="padding: 8px; font-weight: bold; text-align: center;">${s.position}º</td>
      <td style="padding: 8px; font-weight: 600;">${s.pairName}</td>
      <td style="padding: 8px; text-align: center;">${s.matchesPlayed}</td>
      <td style="padding: 8px; text-align: center; color: #16a34a; font-weight: bold;">${s.wins}V - ${s.losses}D</td>
      <td style="padding: 8px; text-align: center; font-weight: bold;">${s.winRate.toFixed(1)}%</td>
      <td style="padding: 8px; text-align: center;">${s.pointsFor}</td>
      <td style="padding: 8px; text-align: center;">${s.pointsAgainst}</td>
      <td style="padding: 8px; text-align: center; font-weight: bold;">${s.pointsBalance > 0 ? '+' : ''}${s.pointsBalance}</td>
    </tr>
  `
    )
    .join('');

  const matchesHtml = matches
    .map((m) => {
      const stageLabel =
        m.stage === 'winners'
          ? `Vencedores R${m.round}`
          : m.stage === 'losers'
          ? `Repescagem R${m.round}`
          : m.stage === 'semifinals'
          ? 'Semifinal'
          : m.stage === 'grand_final'
          ? 'Grande Final'
          : m.stage === 'super_final'
          ? 'Super Final'
          : m.stage;

      const t1 = m.team1 ? `${m.team1.player1} & ${m.team1.player2}` : 'Aguardando';
      const t2 = m.team2 ? `${m.team2.player1} & ${m.team2.player2}` : 'Aguardando';
      const score = formatMatchResult(m);
      const winnerTeam = m.winnerId === m.team1?.id ? m.team1 : m.winnerId === m.team2?.id ? m.team2 : undefined;
      const winner = winnerTeam ? `🏆 ${winnerTeam.player1} & ${winnerTeam.player2}` : '-';

      return `
      <tr style="border-bottom: 1px solid #e2e8f0; font-size: 13px;">
        <td style="padding: 8px; font-weight: bold; text-align: center;">#${m.matchNumber}</td>
        <td style="padding: 8px;">${stageLabel}</td>
        <td style="padding: 8px;">${m.courtName || 'Quadra Principal'}</td>
        <td style="padding: 8px;">${t1}</td>
        <td style="padding: 8px; text-align: center; font-size: 14px;">${score}</td>
        <td style="padding: 8px;">${t2}</td>
        <td style="padding: 8px; font-weight: 600; color: #0987CE;">${winner}</td>
      </tr>
    `;
    })
    .join('');

  const printWindow = window.open('', '_blank');
  if (!printWindow) {
    alert('Por favor, permita popups para imprimir o relatório do torneio.');
    return;
  }

  printWindow.document.write(`
    <!DOCTYPE html>
    <html lang="pt-BR">
    <head>
      <meta charset="UTF-8">
      <title>Relatório Oficial - ${tournament.name}</title>
      <style>
        body { font-family: "Plus Jakarta Sans", -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; margin: 24px; color: #0f172a; }
        button { box-shadow: 0 3px 0 #071d3d33, 0 5px 12px #071d3d22; }
        .header img { width: 64px; height: 64px; border-radius: 50%; float: left; margin-right: 16px; }
        .header { background: #0f172a; color: white; padding: 20px; border-radius: 8px; margin-bottom: 20px; }
        .podium-box { background: #e8f8fc; border: 2px solid #0987CE; padding: 14px 20px; border-radius: 8px; margin-bottom: 24px; }
        table { width: 100%; border-collapse: collapse; margin-bottom: 24px; }
        th { background: #f1f5f9; padding: 8px; text-align: left; font-size: 12px; text-transform: uppercase; color: #475569; }
        @media print {
          body { margin: 0; }
          .no-print { display: none; }
        }
      </style>
    </head>
    <body>
      <div class="no-print" style="margin-bottom: 16px; display: flex; gap: 10px;">
        <button onclick="window.print()" style="background: #0987CE; color: white; font-weight: bold; padding: 10px 20px; border: none; border-radius: 6px; cursor: pointer;">🖨️ Imprimir / Salvar como PDF</button>
        <button onclick="window.close()" style="background: #e2e8f0; color: #1e293b; font-weight: bold; padding: 10px 20px; border: none; border-radius: 6px; cursor: pointer;">Fechar</button>
      </div>

      <div class="header">
        <img src="${window.location.origin}/brand/logo.png" alt="SHARKSET" />
        <h1 style="margin: 0 0 6px 0; font-size: 22px; color: #0987CE;">SHARK SET • RELATÓRIO OFICIAL DO TORNEIO</h1>
        <p style="margin: 0; font-size: 14px; color: #cbd5e1;">${tenant.name} | ${tenant.city} - ${tenant.state} | ${tournament.date}</p>
      </div>

      <div style="background: #f8fafc; border: 1px solid #cbd5e1; padding: 14px; border-radius: 6px; margin-bottom: 20px;">
        <h2 style="margin: 0 0 6px 0; font-size: 18px;">${tournament.name}</h2>
        <p style="margin: 0; font-size: 13px; color: #475569;">
          <strong>Categoria:</strong> ${catLabel} &nbsp;|&nbsp;
          <strong>Modalidade:</strong> ${modLabel} &nbsp;|&nbsp;
          <strong>Organizador:</strong> ${tournament.responsibleName || tenant.ownerName} (${tournament.responsiblePhone || tenant.whatsapp}) &nbsp;|&nbsp;
          <strong>Emissão:</strong> ${new Date().toLocaleString('pt-BR')}
        </p>
      </div>

      <div class="podium-box">
        <h3 style="margin: 0 0 10px 0; font-size: 16px; color: #0987CE;">🏆 PÓDIO OFICIAL DO CAMPEONATO</h3>
        <div style="display: flex; gap: 30px; font-size: 14px; font-weight: bold;">
          <div>🥇 1º Lugar: <span style="color: #0f172a;">${p1}</span></div>
          <div>🥈 2º Lugar: <span style="color: #0f172a;">${p2}</span></div>
          <div>🥉 3º Lugar: <span style="color: #0f172a;">${p3}</span></div>
        </div>
      </div>

      <h3 style="margin: 0 0 8px 0; font-size: 16px;">Classificação e aproveitamento</h3>
      <table>
        <thead>
          <tr>
            <th style="text-align: center;">Pos</th>
            <th>Dupla / Atletas</th>
            <th style="text-align: center;">Jogos</th>
            <th style="text-align: center;">Vitórias</th>
            <th style="text-align: center;">Win Rate %</th>
            <th style="text-align: center;">GP</th>
            <th style="text-align: center;">GC</th>
            <th style="text-align: center;">Saldo</th>
          </tr>
        </thead>
        <tbody>
          ${standingsHtml}
        </tbody>
      </table>

      <h3 style="margin: 0 0 8px 0; font-size: 16px;">Resultados das Partidas da Tabela</h3>
      <table>
        <thead>
          <tr>
            <th style="text-align: center;">#</th>
            <th>Fase</th>
            <th>Quadra</th>
            <th>Dupla 1</th>
            <th style="text-align: center;">Placar</th>
            <th>Dupla 2</th>
            <th>Vencedor</th>
          </tr>
        </thead>
        <tbody>
          ${matchesHtml}
        </tbody>
      </table>

      <div style="text-align: center; font-size: 12px; color: #94a3b8; margin-top: 30px;">
        Documento gerado automaticamente pelo sistema SHARK SET Arena & Futevôlei. Válido para arquivo e premiações.
      </div>

      <script>
        // Automatically focus for printing
        window.onload = function() {
          // printWindow ready
        };
      </script>
    </body>
    </html>
  `);

  printWindow.document.close();
}
