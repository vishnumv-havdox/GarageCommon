import { AlertCircle, User, Briefcase, Car } from "lucide-react";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { DuplicatePhoneResult } from "@/lib/duplicatePhoneCheck";

interface DuplicatePhoneDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    duplicateData: DuplicatePhoneResult;
    onContinue: () => void;
    onCancel: () => void;
}

export function DuplicatePhoneDialog({
    open,
    onOpenChange,
    duplicateData,
    onContinue,
    onCancel
}: DuplicatePhoneDialogProps) {
    if (!duplicateData.existingUser) return null;

    const { existingUser } = duplicateData;

    const getIcon = () => {
        switch (existingUser.type) {
            case 'customer':
                return <User className="h-5 w-5 text-blue-600" />;
            case 'employee':
                return <Briefcase className="h-5 w-5 text-green-600" />;
            case 'driver':
                return <Car className="h-5 w-5 text-orange-600" />;
        }
    };

    const getTypeLabel = () => {
        switch (existingUser.type) {
            case 'customer':
                return 'Customer';
            case 'employee':
                return 'Employee';
            case 'driver':
                return 'Driver';
        }
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-md">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2 text-amber-600">
                        <AlertCircle className="h-5 w-5" />
                        Phone Number Already Exists
                    </DialogTitle>
                    <DialogDescription className="pt-4">
                        This phone number is already registered in the system.
                    </DialogDescription>
                </DialogHeader>

                <div className="bg-muted/50 rounded-lg p-4 space-y-3">
                    <div className="flex items-center gap-2">
                        {getIcon()}
                        <span className="font-semibold text-sm text-muted-foreground">
                            Existing {getTypeLabel()}
                        </span>
                    </div>

                    <div className="space-y-2">
                        <div>
                            <span className="text-xs text-muted-foreground">Name:</span>
                            <p className="font-medium">{existingUser.name}</p>
                        </div>

                        <div>
                            <span className="text-xs text-muted-foreground">Phone:</span>
                            <p className="font-medium">{existingUser.phone}</p>
                        </div>

                        {existingUser.email && (
                            <div>
                                <span className="text-xs text-muted-foreground">Email:</span>
                                <p className="font-medium text-sm">{existingUser.email}</p>
                            </div>
                        )}

                        {existingUser.company_name && (
                            <div>
                                <span className="text-xs text-muted-foreground">Company:</span>
                                <p className="font-medium text-sm">{existingUser.company_name}</p>
                            </div>
                        )}
                    </div>
                </div>

                <DialogDescription className="text-sm">
                    Do you want to continue with these existing user details?
                </DialogDescription>

                <DialogFooter className="gap-2">
                    <Button variant="outline" onClick={onCancel}>
                        Cancel
                    </Button>
                    <Button onClick={onContinue}>
                        Continue with Existing Details
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
