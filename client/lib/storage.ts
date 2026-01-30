const STORAGE_KEY = "lisan_notes";

export interface PoolNote {
  type: "pool";
  commitment: string;
  amount: string;
  secret: string;
  nullifierSecret: string;
  leafIndex?: number;
  spent: boolean;
  createdAt: number;
}

export interface AmmNote {
  type: "amm";
  commitment: string;
  amount: string;
  tokenType: string;
  secret: string;
  nullifierSecret: string;
  leafIndex?: number;
  spent: boolean;
  createdAt: number;
}

export interface BetNote {
  type: "bet";
  commitment: string;
  marketId: number;
  outcome: string;
  amount: string;
  secret: string;
  nullifierSecret: string;
  claimed: boolean;
  createdAt: number;
}

export interface VoteNote {
  type: "vote";
  commitment: string;
  proposalId: number;
  choice: string;
  secret: string;
  nullifierSecret: string;
  nullifierHash: string;
  createdAt: number;
}

export type Note = PoolNote | AmmNote | BetNote | VoteNote;

function getAllNotes(): Note[] {
  if (typeof window === "undefined") return [];
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) return [];
  try {
    return JSON.parse(raw);
  } catch {
    return [];
  }
}

function saveAllNotes(notes: Note[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(notes));
}

export function addNote(note: Note) {
  const notes = getAllNotes();
  notes.push(note);
  saveAllNotes(notes);
}

export function getPoolNotes(): PoolNote[] {
  return getAllNotes().filter((n): n is PoolNote => n.type === "pool");
}

export function getAmmNotes(): AmmNote[] {
  return getAllNotes().filter((n): n is AmmNote => n.type === "amm");
}

export function getBetNotes(): BetNote[] {
  return getAllNotes().filter((n): n is BetNote => n.type === "bet");
}

export function getVoteNotes(): VoteNote[] {
  return getAllNotes().filter((n): n is VoteNote => n.type === "vote");
}

export function markPoolNoteSpent(commitment: string) {
  const notes = getAllNotes();
  const note = notes.find(n => n.type === "pool" && n.commitment === commitment) as PoolNote | undefined;
  if (note) note.spent = true;
  saveAllNotes(notes);
}

export function markAmmNoteSpent(commitment: string) {
  const notes = getAllNotes();
  const note = notes.find(n => n.type === "amm" && n.commitment === commitment) as AmmNote | undefined;
  if (note) note.spent = true;
  saveAllNotes(notes);
}

export function markBetNoteClaimed(commitment: string) {
  const notes = getAllNotes();
  const note = notes.find(n => n.type === "bet" && n.commitment === commitment) as BetNote | undefined;
  if (note) note.claimed = true;
  saveAllNotes(notes);
}

export function exportNotes(): string {
  return JSON.stringify(getAllNotes(), null, 2);
}

export function importNotes(json: string) {
  const notes = JSON.parse(json) as Note[];
  saveAllNotes(notes);
}
