import { supabase } from "@/integrations/supabase/client";

export type Auction = {
  id: string;
  owner_id: string;
  title: string;
  description: string;
  starting_price: number;
  min_increment: number;
  current_price: number;
  leader_id: string | null;
  last_seq: number;
  bid_count: number;
  status: string;
  ends_at: string | null;
  created_at: string;
};

export type Bid = {
  id: string;
  auction_id: string;
  bidder_id: string;
  bidder_name: string;
  amount: number;
  seq: number;
  created_at: string;
};

export type AuctionMessage = {
  id: string;
  auction_id: string;
  user_id: string;
  sender_name: string;
  content: string;
  created_at: string;
};

export type BidResult =
  | { ok: true; seq: number; amount: number; min_required: number }
  | { ok: false; reason: string; min_required?: number; current_price?: number };

export type InvariantReport = {
  ok: boolean;
  accepted: number;
  max_seq: number;
  violations: string[];
};

export const money = (value: number) =>
  new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(value);

export async function listAuctions(): Promise<Auction[]> {
  const { data, error } = await supabase
    .from("auctions")
    .select("*")
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data ?? []) as Auction[];
}

export async function getAuction(id: string): Promise<Auction | null> {
  const { data, error } = await supabase.from("auctions").select("*").eq("id", id).maybeSingle();
  if (error) throw error;
  return (data as Auction) ?? null;
}

export async function listBids(auctionId: string, limit = 200): Promise<Bid[]> {
  const { data, error } = await supabase
    .from("bids")
    .select("*")
    .eq("auction_id", auctionId)
    .order("seq", { ascending: false })
    .limit(limit);
  if (error) throw error;
  return (data ?? []) as Bid[];
}

export async function listMessages(auctionId: string, limit = 100): Promise<AuctionMessage[]> {
  const { data, error } = await supabase
    .from("auction_messages")
    .select("*")
    .eq("auction_id", auctionId)
    .order("created_at", { ascending: true })
    .limit(limit);
  if (error) throw error;
  return (data ?? []) as AuctionMessage[];
}

export async function sendMessage(auctionId: string, userId: string, content: string) {
  const { data: profile } = await supabase
    .from("profiles")
    .select("display_name")
    .eq("id", userId)
    .maybeSingle();
  const { error } = await supabase.from("auction_messages").insert({
    auction_id: auctionId,
    user_id: userId,
    sender_name: profile?.display_name || "bidder",
    content: content.trim(),
  });
  if (error) throw error;
}

export async function placeBid(auctionId: string, amount: number): Promise<BidResult> {
  const { data, error } = await supabase.rpc("place_bid", {
    p_auction_id: auctionId,
    p_amount: amount,
  });
  if (error) return { ok: false, reason: error.message };
  return data as unknown as BidResult;
}

export async function checkInvariant(auctionId: string): Promise<InvariantReport> {
  const { data, error } = await supabase.rpc("check_auction_invariant", {
    p_auction_id: auctionId,
  });
  if (error) throw error;
  return data as unknown as InvariantReport;
}

export const nextMinimum = (auction: Auction) =>
  auction.bid_count === 0
    ? Number(auction.starting_price)
    : Number(auction.current_price) + Number(auction.min_increment);

export const reasonText = (reason: string) => {
  switch (reason) {
    case "not_signed_in":
      return "Sign in to place a bid.";
    case "too_low":
      return "Someone outbid you — your amount is below the new minimum.";
    case "auction_not_live":
      return "This auction isn't open for bids.";
    case "auction_ended":
      return "This auction has ended.";
    case "no_such_auction":
      return "Auction not found.";
    default:
      return reason;
  }
};
