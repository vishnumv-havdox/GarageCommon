import React, { useState } from "react";
import { AdminSidebar } from "@/components/layout/AdminSidebar";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { 
  Shield, 
  Users, 
  UserCog, 
  Search, 
  RefreshCw,
  Edit,
  Lock,
  ChevronRight,
  ArrowUpDown,
  Eye
} from "lucide-react";
import { accessControlConfig, type AccessRule } from "@/config/accessControl";
import { useAuth, UserRole } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";

interface AccessRuleWithStatus extends AccessRule {
  id: string;
  enabled: boolean;
}

type SortField = "path" | "description" | "allowedRoles";
type SortOrder = "asc" | "desc";

export default function AccessControlPage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [searchTerm, setSearchTerm] = useState("");
  const [sortField, setSortField] = useState<SortField>("path");
  const [sortOrder, setSortOrder] = useState<SortOrder>("asc");
  const [rules, setRules] = useState<AccessRuleWithStatus[]>(
    accessControlConfig.filter(r => r.path !== "*").map((r, i) => ({
      ...r,
      id: `rule-${i}`,
      enabled: true,
    }))
  );
  const [selectedRule, setSelectedRule] = useState<AccessRuleWithStatus | null>(null);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);

  const allRoles: UserRole[] = ["admin", "staff", "customer"];

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortOrder(prev => prev === "asc" ? "desc" : "asc");
    } else {
      setSortField(field);
      setSortOrder("asc");
    }
  };

  const filteredRules = rules.filter(rule => {
    const term = searchTerm.toLowerCase();
    return (
      rule.path.toLowerCase().includes(term) ||
      rule.description.toLowerCase().includes(term) ||
      rule.allowedRoles.some(r => r.toLowerCase().includes(term))
    );
  }).sort((a, b) => {
    let comparison = 0;
    if (sortField === "path") {
      comparison = a.path.localeCompare(b.path);
    } else if (sortField === "description") {
      comparison = a.description.localeCompare(b.description);
    } else if (sortField === "allowedRoles") {
      comparison = a.allowedRoles.join(",").localeCompare(b.allowedRoles.join(","));
    }
    return sortOrder === "asc" ? comparison : -comparison;
  });

  const handleToggleEnabled = (ruleId: string) => {
    setRules(prev => prev.map(r => 
      r.id === ruleId ? { ...r, enabled: !r.enabled } : r
    ));
    toast({
      title: "Rule Updated",
      description: "The access rule has been updated.",
    });
  };

  const handleEditRoles = (ruleId: string, newRoles: UserRole[]) => {
    setRules(prev => prev.map(r => 
      r.id === ruleId ? { ...r, allowedRoles: newRoles } : r
    ));
    setIsEditDialogOpen(false);
    toast({
      title: "Permissions Updated",
      description: "Access control permissions have been saved.",
    });
  };

  const getRoleBadgeVariant = (role: string): "default" | "destructive" | "secondary" => 
    role === "admin" ? "destructive" : role === "staff" ? "default" : "secondary";

  const getRoleIcon = (role: string) => 
    role === "admin" ? <Shield className="h-3 w-3" /> : 
    role === "staff" ? <UserCog className="h-3 w-3" /> : 
    <Users className="h-3 w-3" />;

  const SortButton = ({ field, label }: { field: SortField; label: string }) => (
    <Button 
      variant="ghost" 
      size="sm" 
      className="gap-1 h-8 font-medium"
      onClick={() => handleSort(field)}
    >
      {label}
      <ArrowUpDown className="h-3 w-3" />
    </Button>
  );

  return (
    <div className="min-h-screen bg-background">
      <div className="flex">
        <AdminSidebar />
        <main className="flex-1 p-8">
          <div className="flex items-center justify-between mb-8">
            <div>
              <h1 className="text-3xl font-bold flex items-center gap-2">
                <Lock className="h-8 w-8" />
                Access Control
              </h1>
              <p className="text-muted-foreground">
                Manage which user roles can access which pages. This is the single source of truth for authorization.
              </p>
            </div>
            <Button variant="outline" onClick={() => window.location.reload()}>
              <RefreshCw className="h-4 w-4 mr-2" />
              Reset to Default
            </Button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  Total Rules
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{rules.length}</div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  Admin-Only Routes
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-destructive">
                  {rules.filter(r => r.allowedRoles.length === 1 && r.allowedRoles[0] === "admin").length}
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  Staff Accessible Routes
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {rules.filter(r => r.allowedRoles.includes("staff")).length}
                </div>
              </CardContent>
            </Card>
          </div>

          <Card className="mb-6">
            <CardContent className="pt-6">
              <div className="relative max-w-md">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input 
                  placeholder="Search routes, descriptions, or roles..." 
                  value={searchTerm} 
                  onChange={e => setSearchTerm(e.target.value)} 
                  className="pl-10" 
                />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Route Permissions</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b">
                      <th className="text-left p-3 w-10">Enabled</th>
                      <th className="text-left p-3">
                        <SortButton field="path" label="Route Path" />
                      </th>
                      <th className="text-left p-3">
                        <SortButton field="description" label="Description" />
                      </th>
                      <th className="text-left p-3">
                        <SortButton field="allowedRoles" label="Allowed Roles" />
                      </th>
                      <th className="text-left p-3 w-24">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredRules.map((rule) => (
                      <tr key={rule.id} className="border-b hover:bg-muted/50">
                        <td className="p-3">
                          <Switch 
                            checked={rule.enabled}
                            onCheckedChange={() => handleToggleEnabled(rule.id)}
                          />
                        </td>
                        <td className="p-3 font-mono text-sm">
                          {rule.path}
                        </td>
                        <td className="p-3 text-sm text-muted-foreground">
                          {rule.description}
                        </td>
                        <td className="p-3">
                          <div className="flex flex-wrap gap-1">
                            {rule.allowedRoles.map((role) => (
                              <Badge 
                                key={role} 
                                variant={getRoleBadgeVariant(role)}
                                className="gap-1"
                              >
                                {getRoleIcon(role)}
                                {role.charAt(0).toUpperCase() + role.slice(1)}
                              </Badge>
                            ))}
                          </div>
                        </td>
                        <td className="p-3">
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => {
                              setSelectedRule(rule);
                              setIsEditDialogOpen(true);
                            }}
                          >
                            <Edit className="h-4 w-4" />
                          </Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {filteredRules.length === 0 && (
                <div className="text-center py-8 text-muted-foreground">
                  No rules found matching your search.
                </div>
              )}
            </CardContent>
          </Card>

          <Card className="mt-6">
            <CardHeader>
              <CardTitle className="text-lg">Role Permissions Legend</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="flex items-center gap-3 p-4 border rounded-lg">
                  <Shield className="h-5 w-5 text-destructive" />
                  <div>
                    <p className="font-medium">Admin</p>
                    <p className="text-sm text-muted-foreground">Full system access</p>
                  </div>
                </div>
                <div className="flex items-center gap-3 p-4 border rounded-lg">
                  <UserCog className="h-5 w-5 text-primary" />
                  <div>
                    <p className="font-medium">Staff</p>
                    <p className="text-sm text-muted-foreground">Limited management access</p>
                  </div>
                </div>
                <div className="flex items-center gap-3 p-4 border rounded-lg">
                  <Users className="h-5 w-5 text-secondary-foreground" />
                  <div>
                    <p className="font-medium">Customer</p>
                    <p className="text-sm text-muted-foreground">Portal access only</p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </main>
      </div>

      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Route Permissions</DialogTitle>
          </DialogHeader>
          {selectedRule && (
            <>
              <div className="py-4 space-y-4">
                <div>
                  <Label className="text-muted-foreground">Route Path</Label>
                  <p className="font-mono text-sm mt-1">{selectedRule.path}</p>
                </div>
                <div>
                  <Label className="text-muted-foreground">Description</Label>
                  <p className="text-sm mt-1">{selectedRule.description}</p>
                </div>
                <div>
                  <Label className="text-muted-foreground mb-2 block">Allowed Roles</Label>
                  <div className="flex flex-wrap gap-2">
                    {allRoles.map((role) => (
                      <div 
                        key={role}
                        className={`flex items-center gap-2 px-3 py-2 rounded-lg border cursor-pointer transition-colors ${
                          selectedRule.allowedRoles.includes(role)
                            ? "border-primary bg-primary/10"
                            : "border-muted hover:border-muted-foreground"
                        }`}
                        onClick={() => {
                          const newRoles = selectedRule.allowedRoles.includes(role)
                            ? selectedRule.allowedRoles.filter(r => r !== role)
                            : [...selectedRule.allowedRoles, role];
                          setSelectedRule({ ...selectedRule, allowedRoles: newRoles });
                        }}
                      >
                        {getRoleIcon(role)}
                        <span className="capitalize">{role}</span>
                        {selectedRule.allowedRoles.includes(role) && (
                          <Eye className="h-3 w-3 ml-1" />
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setIsEditDialogOpen(false)}>
                  Cancel
                </Button>
                <Button 
                  onClick={() => handleEditRoles(selectedRule.id, selectedRule.allowedRoles)}
                  disabled={selectedRule.allowedRoles.length === 0}
                >
                  Save Changes
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

