import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import type { User } from "@supabase/supabase-js";

import { supabase } from "@/integrations/supabase/client";
import { SiteHeader } from "@/components/site-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { money, type Auction } from "@/lib/auction-api";

export const Route = createFileRoute("/manage")({
  head: () => ({
    meta: [
      { title: "My auctions — BidBlock" },
      {
        name: "description",
        content: "Create auctions, set the minimum increment, and close bidding when you're done.",
      },
      { property: "og:title", content: "My auctions — BidBlock" },
      {
        property: "og:description",
        content: "Create auctions, set the minimum increment, and close bidding when you're done.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: ManagePage,
});

function ManagePage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [user, setUser] = useState<User | null>(null);
  const [ready, setReady] = useState(false);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [startingPrice, setStartingPrice] = useState("100");
  const [minIncrement, setMinIncrement] = useState("5");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      setUser(data.user ?? null);
      setReady(true);
      if (!data.user) navigate({ to: "/auth", replace: true });
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_e, session) =>
      setUser(session?.user ?? null),
    );
    return () => sub.subscription.unsubscribe();
  }, [navigate]);

  const myAuctions = useQuery({
    queryKey: ["my-auctions", user?.id],
    enabled: !!user,
    queryFn: async () => {
      if (!user) return [];
      const { data, error: err } = await supabase
        .from("auctions")
        .select("*")
        .eq("owner_id", user.id)
        .order("created_at", { ascending: false });
      if (err) throw err;
      return (data ?? []) as Auction[];
    },
  });

  async function createAuction(e: React.FormEvent) {
    e.preventDefault();
    if (!user) return;
    setSaving(true);
    setError(null);
    const { error: err } = await supabase.from("auctions").insert({
      owner_id: user.id,
      title: title.trim(),
      description: description.trim(),
      starting_price: Number(startingPrice),
      min_increment: Number(minIncrement),
      current_price: Number(startingPrice),
      status: "live",
    });
    setSaving(false);
    if (err) {
      setError(err.message);
      return;
    }
    setTitle("");
    setDescription("");
    queryClient.invalidateQueries({ queryKey: ["my-auctions", user.id] });
    queryClient.invalidateQueries({ queryKey: ["auctions"] });
  }

  async function setStatus(auction: Auction, status: string) {
    await supabase.from("auctions").update({ status }).eq("id", auction.id);
    queryClient.invalidateQueries({ queryKey: ["my-auctions", user?.id] });
    queryClient.invalidateQueries({ queryKey: ["auctions"] });
  }

  if (!ready || !user) {
    return (
      <div className="min-h-screen bg-background">
        <SiteHeader />
        <p className="mx-auto max-w-3xl px-4 py-10 text-sm text-muted-foreground">Loading…</p>
      </div>
    );
  }

  const auctions = myAuctions.data ?? [];

  return (
    <div className="min-h-screen bg-background">
      <SiteHeader />
      <main className="mx-auto w-full max-w-3xl px-4 py-6 sm:py-10">
        <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">My auctions</h1>

        <form
          onSubmit={createAuction}
          className="mt-5 space-y-4 rounded-2xl border border-border bg-card p-5 sm:p-7"
        >
          <h2 className="text-lg font-semibold tracking-tight">Create an auction</h2>
          <div className="space-y-2">
            <Label htmlFor="title">Title</Label>
            <Input
              id="title"
              required
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="1968 Gibson ES-335"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="description">Description</Label>
            <Textarea
              id="description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Condition, provenance, shipping…"
            />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="start">Starting price</Label>
              <Input
                id="start"
                type="number"
                min="0"
                step="0.01"
                required
                value={startingPrice}
                onChange={(e) => setStartingPrice(e.target.value)}
                className="font-mono"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="inc">Minimum increment</Label>
              <Input
                id="inc"
                type="number"
                min="0.01"
                step="0.01"
                required
                value={minIncrement}
                onChange={(e) => setMinIncrement(e.target.value)}
                className="font-mono"
              />
            </div>
          </div>
          {error && <p className="text-sm text-destructive">{error}</p>}
          <Button type="submit" disabled={saving}>
            {saving ? "Creating…" : "Create auction"}
          </Button>
        </form>

        <div className="mt-8 space-y-3">
          {myAuctions.isLoading && <p className="text-sm text-muted-foreground">Loading…</p>}
          {!myAuctions.isLoading && auctions.length === 0 && (
            <p className="text-sm text-muted-foreground">You haven't created any auctions yet.</p>
          )}
          {auctions.map((auction) => (
            <div
              key={auction.id}
              className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border bg-card p-4"
            >
              <div className="min-w-0">
                <Link
                  to="/auctions/$id"
                  params={{ id: auction.id }}
                  className="font-semibold tracking-tight hover:text-primary"
                >
                  {auction.title}
                </Link>
                <p className="font-mono text-xs text-muted-foreground">
                  {money(Number(auction.bid_count === 0 ? auction.starting_price : auction.current_price))} ·{" "}
                  {auction.bid_count} bids · +{money(Number(auction.min_increment))} · {auction.status}
                </p>
              </div>
              <div className="flex gap-2">
                {auction.status === "live" ? (
                  <Button size="sm" variant="secondary" onClick={() => setStatus(auction, "ended")}>
                    End
                  </Button>
                ) : (
                  <Button size="sm" variant="secondary" onClick={() => setStatus(auction, "live")}>
                    Reopen
                  </Button>
                )}
                <Button size="sm" asChild>
                  <Link to="/auctions/$id" params={{ id: auction.id }}>
                    Open
                  </Link>
                </Button>
                <Button size="sm" variant="outline" asChild>
                  <Link to="/auctions/$id/edit" params={{ id: auction.id }}>
                    Edit
                  </Link>
                </Button>
              </div>
            </div>
          ))}
        </div>
      </main>
    </div>
  );
}
