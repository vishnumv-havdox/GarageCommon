import { useEffect } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { CheckCircle2, ArrowLeft, LayoutDashboard, FileText, User, Clock } from "lucide-react";
import { format } from "date-fns";

export default function RequestConfirmation() {
    const location = useLocation();
    const navigate = useNavigate();
    const { state } = location;

    useEffect(() => {
        if (!state) {
            navigate("/admin/requests", { replace: true });
        }
    }, [state, navigate]);

    if (!state) return null;

    const { type, id, requester, status, acceptedAt } = state;

    return (
        <div className="container mx-auto flex items-center justify-center min-h-[80vh] p-6">
            <Card className="w-full max-w-md border-green-500/20 shadow-lg">
                <CardHeader className="text-center pb-2">
                    <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-full bg-green-100 mb-4">
                        <CheckCircle2 className="h-10 w-10 text-green-600" />
                    </div>
                    <CardTitle className="text-2xl font-bold text-green-700">Request Accepted</CardTitle>
                    <p className="text-muted-foreground">The request has been successfully processed.</p>
                </CardHeader>
                <CardContent className="space-y-4">
                    <div className="bg-muted p-4 rounded-lg space-y-3 text-sm">
                        <div className="flex justify-between items-center pb-2 border-b border-muted-foreground/10">
                            <span className="text-muted-foreground flex items-center gap-2">
                                <FileText className="h-4 w-4" /> Type
                            </span>
                            <span className="font-semibold">{type}</span>
                        </div>
                        <div className="flex justify-between items-center pb-2 border-b border-muted-foreground/10">
                            <span className="text-muted-foreground flex items-center gap-2">
                                <LayoutDashboard className="h-4 w-4" /> ID
                            </span>
                            <span className="font-mono">{id.slice(0, 8)}...</span>
                        </div>
                        <div className="flex justify-between items-center pb-2 border-b border-muted-foreground/10">
                            <span className="text-muted-foreground flex items-center gap-2">
                                <User className="h-4 w-4" /> Requester
                            </span>
                            <span className="font-semibold">{requester}</span>
                        </div>
                        <div className="flex justify-between items-center pb-2 border-b border-muted-foreground/10">
                            <span className="text-muted-foreground flex items-center gap-2">
                                <CheckCircle2 className="h-4 w-4" /> Status
                            </span>
                            <span className="font-bold text-green-600">{status}</span>
                        </div>
                        <div className="flex justify-between items-center">
                            <span className="text-muted-foreground flex items-center gap-2">
                                <Clock className="h-4 w-4" /> Time
                            </span>
                            <span>{acceptedAt ? format(new Date(acceptedAt), "p") : "Just now"}</span>
                        </div>
                    </div>
                </CardContent>
                <CardFooter className="flex flex-col gap-3">
                    <Button
                        className="w-full bg-green-600 hover:bg-green-700"
                        onClick={() => navigate("/admin/requests")}
                    >
                        <ArrowLeft className="mr-2 h-4 w-4" /> Back to Inbox
                    </Button>
                    <Button
                        variant="ghost"
                        className="w-full"
                        onClick={() => navigate("/admin")}
                    >
                        Go to Dashboard
                    </Button>
                </CardFooter>
            </Card>
        </div>
    );
}
