import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Truck } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { ensureAdmin } from "@/lib/ensure-admin.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

export const Route = createFileRoute("/auth")({
  component: AuthPage,
});

function AuthPage() {
  const navigate = useNavigate();
  const { user, role, loading, refresh } = useAuth();
  const [busy, setBusy] = useState(false);
  const ensureAdminFn = useServerFn(ensureAdmin);

  useEffect(() => {
    // Idempotently ensure the single admin account exists
    ensureAdminFn({}).catch((e) => console.error("ensureAdmin failed", e));
  }, [ensureAdminFn]);

  useEffect(() => {
    if (loading) return;
    if (user && role === "admin") navigate({ to: "/admin" });
    else if (user && role === "driver") navigate({ to: "/driver" });
  }, [user, role, loading, navigate]);

  const [signInEmail, setSignInEmail] = useState("");
  const [signInPass, setSignInPass] = useState("");

  const [signUpName, setSignUpName] = useState("");
  const [signUpEmail, setSignUpEmail] = useState("");
  const [signUpPass, setSignUpPass] = useState("");

  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    const { error } = await supabase.auth.signInWithPassword({
      email: signInEmail,
      password: signInPass,
    });
    setBusy(false);
    if (error) return toast.error(error.message);
    await refresh();
  };

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    const { data, error } = await supabase.auth.signUp({
      email: signUpEmail,
      password: signUpPass,
      options: {
        emailRedirectTo: window.location.origin,
        data: { full_name: signUpName },
      },
    });
    if (error) {
      setBusy(false);
      return toast.error(error.message);
    }
    // All signups are driver accounts
    if (data.user) {
      const { error: roleErr } = await supabase
        .from("user_roles")
        .insert({ user_id: data.user.id, role: "driver" });
      if (roleErr) {
        setBusy(false);
        return toast.error("Role assignment failed: " + roleErr.message);
      }
    }
    await refresh();
    setBusy(false);
    toast.success("Account created. Awaiting admin approval.");
    navigate({ to: "/driver", replace: true });
  };

  return (
    <div className="min-h-screen bg-background grid place-items-center px-4 py-10">
      <div className="w-full max-w-md">
        <div className="mb-6 flex items-center justify-center gap-2">
          <div className="grid h-9 w-9 place-items-center rounded-md bg-primary text-primary-foreground">
            <Truck className="h-4 w-4" />
          </div>
          <span className="text-lg font-semibold">RunSheet</span>
        </div>
        <Card>
          <CardHeader>
            <CardTitle>Welcome</CardTitle>
            <CardDescription>
              Sign in as admin, or create a driver account to continue.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Tabs defaultValue="signin">
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="signin">Sign in</TabsTrigger>
                <TabsTrigger value="signup">Driver sign up</TabsTrigger>
              </TabsList>
              <TabsContent value="signin">
                <form onSubmit={handleSignIn} className="space-y-4 pt-4">
                  <div className="space-y-2">
                    <Label htmlFor="si-email">Email</Label>
                    <Input
                      id="si-email"
                      type="email"
                      required
                      value={signInEmail}
                      onChange={(e) => setSignInEmail(e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="si-pass">Password</Label>
                    <Input
                      id="si-pass"
                      type="password"
                      required
                      value={signInPass}
                      onChange={(e) => setSignInPass(e.target.value)}
                    />
                  </div>
                  <Button type="submit" className="w-full" disabled={busy}>
                    Sign in
                  </Button>
                </form>
              </TabsContent>
              <TabsContent value="signup">
                <form onSubmit={handleSignUp} className="space-y-4 pt-4">
                  <div className="space-y-2">
                    <Label htmlFor="su-name">Full name</Label>
                    <Input
                      id="su-name"
                      required
                      value={signUpName}
                      onChange={(e) => setSignUpName(e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="su-email">Email</Label>
                    <Input
                      id="su-email"
                      type="email"
                      required
                      value={signUpEmail}
                      onChange={(e) => setSignUpEmail(e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="su-pass">Password</Label>
                    <Input
                      id="su-pass"
                      type="password"
                      required
                      minLength={6}
                      value={signUpPass}
                      onChange={(e) => setSignUpPass(e.target.value)}
                    />
                  </div>
                  <p className="text-xs text-muted-foreground">
                    New sign-ups are created as driver accounts. The admin account is managed by
                    the system.
                  </p>
                  <Button type="submit" className="w-full" disabled={busy}>
                    Create driver account
                  </Button>
                </form>
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
