import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import type { User } from "@supabase/supabase-js";

import { SiteHeader } from "@/components/site-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { getAuction, type Auction } from "@/lib/auction-api";

export const Route = createFileRoute("/auctions/$id/edit")({
  head: () => ({
    meta: [
      { title: "Edit auction — BidBlock" },
      { name: "description", content: "Update the price, bid increment, and closing time for your auction." },
      { property: "og:title", content: "Edit auction — BidBlock" },
      { property: "og:description", content: "Update an auction's pricing and closing time." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: EditAuctionPage,
});

function toLocalDateTime(value: string | null) {
  if (!value) return "";
  const date = new Date(value);
  const offset = date.getTimezoneOffset() * 60_000;
  return new Date(date.getTime() - offset).toISOString().slice(0, 16);
}

function EditAuctionPage() {
  const { id } = Route.useParams();
  const queryClient = useQueryClient();
  const [user, setUser] = useState<User | null>(null);
  const [authReady, setAuthReady] = useState(false);
  const [formAuction, setFormAuction] = useState<Auction | null>(null);
  const [startingPrice, setStartingPrice] = useState("");
  const [minIncrement, setMinIncrement] = useState("");
  const [endsAt, setEndsAt] = useState("");
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState<{ kind: "ok" | "err"; text: string } | null>(null);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      setUser(data.user ?? null);
      setAuthReady(true);
    });
  }, []);

  const auctionQuery = useQuery({ queryKey: ["auction", id], queryFn: () => getAuction(id) });
  const auction = auctionQuery.data;

  useEffect(() => {
    if (!auction || formAuction?.id === auction.id) return;
    setFormAuction(auction);
    setStartingPrice(String(auction.starting_price));
    setMinIncrement(String(auction.min_increment));
    setEndsAt(toLocalDateTime(auction.ends_at));
  }, [auction, formAuction]);

  async function saveAuction(event: React.FormEvent) {
    event.preventDefault();
    if (!auction || !user || user.id !== auction.owner_id) return;
    const start = Number(startingPrice);
    const increment = Number(minIncrement);
    if (!Number.isFinite(start) || start < 0 || !Number.isFinite(increment) || increment <= 0) {
      setNotice({ kind: "err", text: "Enter a valid starting price and an increment above zero." });
      return;
    }
    setSaving(true);
    setNotice(null);
    const updates = {
      starting_price: start,
      min_increment: increment,
      ends_at: endsAt ? new Date(endsAt).toISOString() : null,
    };
    const { error } = await supabase.from("auctions").update(updates).eq("id", auction.id);
    setSaving(false);
    if (error) {
      setNotice({ kind: "err", text: error.message });
      return;
    }
    setNotice({ kind: "ok", text: "Auction settings saved." });
    await queryClient.invalidateQueries({ queryKey: ["auction", id] });
    await queryClient.invalidateQueries({ queryKey: ["my-auctions", user.id] });
    await queryClient.invalidateQueries({ queryKey: ["auctions"] });
  }

  const loading = auctionQuery.isLoading || !authReady;
  const canEdit = !!auction && !!user && auction.owner_id === user.id;

  return (
    <div className="min-h-screen bg-background">
      <SiteHeader />
      <main className="mx-auto w-full max-w-2xl px-4 py-6 sm:py-10">
        <Button variant="ghost" size="sm" asChild>
          <Link to="/manage">← My auctions</Link>
        </Button>
        {loading ? (
          <p className="mt-8 text-sm text-muted-foreground">Loading…</p>
        ) : !auction ? (
          <p className="mt-8 text-sm text-muted-foreground">Auction not found.</p>
        ) : !user ? (
          <div className="mt-8 border-t border-border pt-6">
            <h1 className="text-2xl font-semibold">Sign in to edit this auction</h1>
            <Button className="mt-4" asChild><Link to="/auth">Sign in</Link></Button>
          </div>
        ) : !canEdit ? (
          <p className="mt-8 text-sm text-destructive">Only the auction owner can edit these settings.</p>
        ) : (
          <form onSubmit={saveAuction} className="mt-6 border-t border-border pt-6">
            <p className="text-xs font-medium uppercase text-muted-foreground">Auction settings</p>
            <h1 className="mt-1 text-2xl font-semibold sm:text-3xl">{auction.title}</h1>
            <div className="mt-7 grid gap-5 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="edit-start">Starting price</Label>
                <Input id="edit-start" type="number" min="0" step="0.01" required value={startingPrice} onChange={(e) => setStartingPrice(e.target.value)} className="font-mono" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-increment">Minimum increment</Label>
                <Input id="edit-increment" type="number" min="0.01" step="0.01" required value={minIncrement} onChange={(e) => setMinIncrement(e.target.value)} className="font-mono" />
              </div>
              <div className="space-y-2 sm:col-span-2">
                <Label htmlFor="edit-end">End time</Label>
                <Input id="edit-end" type="datetime-local" value={endsAt} onChange={(e) => setEndsAt(e.target.value)} />
                <p className="text-xs text-muted-foreground">Leave blank to keep bidding open until you end it manually.</p>
              </div>
            </div>
            {auction.bid_count > 0 && <p className="mt-4 text-sm text-muted-foreground">This auction already has bids. Changing the starting price will not replace its current price.</p>}
            {notice && <p className={`mt-4 text-sm ${notice.kind === "ok" ? "text-success" : "text-destructive"}`}>{notice.text}</p>}
            <div className="mt-6 flex flex-col gap-2 sm:flex-row">
              <Button type="submit" disabled={saving}>{saving ? "Saving…" : "Save changes"}</Button>
              <Button variant="secondary" asChild><Link to="/auctions/$id" params={{ id }}>View auction</Link></Button>
            </div>
          </form>
        )}
      </main>
    </div>
  );
}