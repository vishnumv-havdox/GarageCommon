import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

interface SalaryConfigFormProps {
    employeeId: string;
    employeeName: string;
    onSuccess: () => void;
    initialData?: any;
}

export function SalaryConfigForm({ employeeId, employeeName, onSuccess, initialData }: SalaryConfigFormProps) {
    const { toast } = useToast();
    const [loading, setLoading] = useState(false);
    const [formData, setFormData] = useState({
        pay_type: initialData?.pay_type || "monthly",
        base_amount: initialData?.base_amount || 0,
        overtime_rate: initialData?.overtime_rate || 0,
        job_incentive_rate: initialData?.job_incentive_rate || 0,
        allowances: initialData?.allowances || 0,
        payment_method: initialData?.payment_method || "bank_transfer",
        bank_name: initialData?.bank_name || "",
        account_number: initialData?.account_number || "",
        ifsc_code: initialData?.ifsc_code || "",
        upi_id: initialData?.upi_id || "",
    });

    useEffect(() => {
        if (initialData) {
            setFormData({
                pay_type: initialData.pay_type || "monthly",
                base_amount: initialData.base_amount || 0,
                overtime_rate: initialData.overtime_rate || 0,
                job_incentive_rate: initialData.job_incentive_rate || 0,
                allowances: initialData.allowances || 0,
                payment_method: initialData.payment_method || "bank_transfer",
                bank_name: initialData.bank_name || "",
                account_number: initialData.account_number || "",
                ifsc_code: initialData.ifsc_code || "",
                upi_id: initialData.upi_id || "",
            });
        }
    }, [initialData]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        try {
            const { error } = await (supabase
                .from("employee_salary_configs")
                .upsert({
                    employee_id: employeeId,
                    ...formData,
                    updated_at: new Date().toISOString(),
                }, { onConflict: 'employee_id' }) as any);

            if (error) throw error;
            toast({ title: "Success", description: "Salary configuration saved" });
            onSuccess();
        } catch (error: any) {
            toast({ variant: "destructive", title: "Error", description: error.message });
        } finally {
            setLoading(false);
        }
    };

    return (
        <Card className="border-none shadow-none bg-muted/30">
            <CardHeader className="px-0 pt-0">
                <CardTitle className="text-lg">Salary Structure: {employeeName}</CardTitle>
            </CardHeader>
            <CardContent className="px-0 pb-0">
                <form onSubmit={handleSubmit} className="space-y-6">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <Label>Pay Type</Label>
                            <Select
                                value={formData.pay_type}
                                onValueChange={(val) => setFormData(prev => ({ ...prev, pay_type: val }))}
                            >
                                <SelectTrigger>
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="monthly">Monthly Salary</SelectItem>
                                    <SelectItem value="weekly">Weekly Wage</SelectItem>
                                    <SelectItem value="daily">Daily Wage (Per Day)</SelectItem>
                                    <SelectItem value="per-job">Per Job Payment</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>

                        <div className="space-y-2">
                            <Label>Base Amount (₹)</Label>
                            <Input
                                type="number"
                                value={formData.base_amount}
                                onChange={(e) => setFormData(prev => ({ ...prev, base_amount: parseFloat(e.target.value) || 0 }))}
                            />
                        </div>

                        <div className="space-y-2">
                            <Label>Overtime Rate (₹/Hr)</Label>
                            <Input
                                type="number"
                                value={formData.overtime_rate}
                                onChange={(e) => setFormData(prev => ({ ...prev, overtime_rate: parseFloat(e.target.value) || 0 }))}
                            />
                        </div>

                        <div className="space-y-2">
                            <Label>Job Incentive (₹/Job)</Label>
                            <Input
                                type="number"
                                value={formData.job_incentive_rate}
                                onChange={(e) => setFormData(prev => ({ ...prev, job_incentive_rate: parseFloat(e.target.value) || 0 }))}
                            />
                        </div>

                        <div className="space-y-2">
                            <Label>Allowances (₹)</Label>
                            <Input
                                type="number"
                                value={formData.allowances}
                                onChange={(e) => setFormData(prev => ({ ...prev, allowances: parseFloat(e.target.value) || 0 }))}
                            />
                        </div>
                    </div>

                    <div className="border-t pt-4 space-y-4">
                        <h4 className="font-semibold text-sm text-foreground/80">Payment / Bank Details</h4>
                        
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label>Payment Method</Label>
                                <Select
                                    value={formData.payment_method}
                                    onValueChange={(val) => setFormData(prev => ({ ...prev, payment_method: val }))}
                                >
                                    <SelectTrigger>
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="bank_transfer">Bank Transfer</SelectItem>
                                        <SelectItem value="upi">UPI</SelectItem>
                                        <SelectItem value="cash">Cash</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>

                            {formData.payment_method === "upi" && (
                                <div className="space-y-2">
                                    <Label>UPI ID</Label>
                                    <Input
                                        placeholder="e.g. employee@okaxis"
                                        value={formData.upi_id}
                                        onChange={(e) => setFormData(prev => ({ ...prev, upi_id: e.target.value }))}
                                    />
                                </div>
                            )}
                        </div>

                        {formData.payment_method === "bank_transfer" && (
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-2">
                                <div className="space-y-2">
                                    <Label>Bank Name</Label>
                                    <Input
                                        placeholder="e.g. HDFC Bank"
                                        value={formData.bank_name}
                                        onChange={(e) => setFormData(prev => ({ ...prev, bank_name: e.target.value }))}
                                    />
                                </div>
                                <div className="space-y-2">
                                    <Label>Account Number</Label>
                                    <Input
                                        placeholder="e.g. 501002345678"
                                        value={formData.account_number}
                                        onChange={(e) => setFormData(prev => ({ ...prev, account_number: e.target.value }))}
                                    />
                                </div>
                                <div className="space-y-2">
                                    <Label>IFSC Code</Label>
                                    <Input
                                        placeholder="e.g. HDFC0001234"
                                        value={formData.ifsc_code}
                                        onChange={(e) => setFormData(prev => ({ ...prev, ifsc_code: e.target.value.toUpperCase() }))}
                                    />
                                </div>
                            </div>
                        )}

                        {formData.payment_method === "cash" && (
                            <p className="text-xs text-muted-foreground pt-1">
                                Cash payout selected. No electronic transfer details needed.
                            </p>
                        )}
                    </div>

                    <div className="pt-2">
                        <Button type="submit" className="w-full" disabled={loading}>
                            {loading ? "Saving..." : "Save Configuration"}
                        </Button>
                    </div>
                </form>
            </CardContent>
        </Card>
    );
}
