/**
 * Example: Enhanced Phone Input Component with Real-time Validation and Duplicate Detection
 * 
 * This example shows how to implement:
 * 1. Real-time validation while typing
 * 2. Visual feedback (colors, messages)
 * 3. Duplicate phone number detection
 * 4. Confirmation dialog for existing users
 * 
 * Usage in your forms:
 * - Import this component or copy the pattern
 * - Use the hooks and utilities provided
 */

import { useState, useEffect } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { validatePhoneRealtime, getPhoneInputClasses } from "@/lib/phoneValidation";
import { checkDuplicatePhone, DuplicatePhoneResult } from "@/lib/duplicatePhoneCheck";
import { DuplicatePhoneDialog } from "@/components/shared/DuplicatePhoneDialog";
import { Loader2 } from "lucide-react";

interface EnhancedPhoneInputProps {
    value: string;
    onChange: (value: string) => void;
    onDuplicateConfirmed?: (duplicateData: DuplicatePhoneResult) => void;
    label?: string;
    required?: boolean;
    disabled?: boolean;
}

export function EnhancedPhoneInput({
    value,
    onChange,
    onDuplicateConfirmed,
    label = "Phone Number",
    required = false,
    disabled = false
}: EnhancedPhoneInputProps) {
    const [validationState, setValidationState] = useState<'empty' | 'typing' | 'valid' | 'invalid'>('empty');
    const [validationMessage, setValidationMessage] = useState<string>('');
    const [isCheckingDuplicate, setIsCheckingDuplicate] = useState(false);
    const [duplicateData, setDuplicateData] = useState<DuplicatePhoneResult | null>(null);
    const [showDuplicateDialog, setShowDuplicateDialog] = useState(false);

    // Real-time validation while typing
    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const newValue = e.target.value;
        onChange(newValue);

        // Validate in real-time
        const validation = validatePhoneRealtime(newValue);
        setValidationState(validation.state);
        setValidationMessage(validation.message || '');

        // If valid and complete (10 digits), check for duplicates
        if (validation.state === 'valid' && validation.cleaned.length === 10) {
            checkForDuplicate(validation.cleaned);
        }
    };

    // Check for duplicate phone numbers
    const checkForDuplicate = async (phone: string) => {
        setIsCheckingDuplicate(true);
        try {
            const result = await checkDuplicatePhone(phone);
            if (result.isDuplicate) {
                setDuplicateData(result);
                setShowDuplicateDialog(true);
            }
        } catch (error) {
            console.error('Error checking duplicate:', error);
        } finally {
            setIsCheckingDuplicate(false);
        }
    };

    // Handle duplicate confirmation
    const handleDuplicateConfirm = () => {
        if (duplicateData && onDuplicateConfirmed) {
            onDuplicateConfirmed(duplicateData);
        }
        setShowDuplicateDialog(false);
    };

    // Handle duplicate cancellation
    const handleDuplicateCancel = () => {
        setShowDuplicateDialog(false);
        onChange(''); // Clear the input
        setValidationState('empty');
        setValidationMessage('');
    };

    return (
        <div className="space-y-2">
            <Label htmlFor="phone">
                {label} {required && '*'}
            </Label>

            <div className="relative">
                <Input
                    id="phone"
                    type="tel"
                    placeholder="Enter 10-digit phone number"
                    value={value}
                    onChange={handleChange}
                    disabled={disabled}
                    className={getPhoneInputClasses(validationState)}
                    maxLength={15} // Allow some extra for formatting
                />

                {/* Loading indicator for duplicate check */}
                {isCheckingDuplicate && (
                    <div className="absolute right-3 top-1/2 -translate-y-1/2">
                        <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                    </div>
                )}
            </div>

            {/* Validation message */}
            {validationMessage && (
                <p className={`text-xs ${validationState === 'valid' ? 'text-green-600' :
                        validationState === 'invalid' ? 'text-destructive' :
                            'text-muted-foreground'
                    }`}>
                    {validationMessage}
                </p>
            )}

            {/* Duplicate phone dialog */}
            {duplicateData && (
                <DuplicatePhoneDialog
                    open={showDuplicateDialog}
                    onOpenChange={setShowDuplicateDialog}
                    duplicateData={duplicateData}
                    onContinue={handleDuplicateConfirm}
                    onCancel={handleDuplicateCancel}
                />
            )}
        </div>
    );
}

/**
 * INTEGRATION EXAMPLE FOR EXISTING FORMS
 * 
 * To integrate into CustomerForm, EmployeeForm, etc:
 * 
 * 1. Add state for phone validation:
 *    const [phoneValidationState, setPhoneValidationState] = useState<'empty' | 'typing' | 'valid' | 'invalid'>('empty');
 * 
 * 2. Update phone input onChange handler:
 *    const handlePhoneChange = (e) => {
 *      const newValue = e.target.value;
 *      setFormData(prev => ({ ...prev, phone: newValue }));
 *      
 *      const validation = validatePhoneRealtime(newValue);
 *      setPhoneValidationState(validation.state);
 *      
 *      if (validation.state === 'valid') {
 *        checkForDuplicate(validation.cleaned);
 *      }
 *    };
 * 
 * 3. Add duplicate checking:
 *    const checkForDuplicate = async (phone: string) => {
 *      const result = await checkDuplicatePhone(phone);
 *      if (result.isDuplicate) {
 *        setDuplicateData(result);
 *        setShowDuplicateDialog(true);
 *      }
 *    };
 * 
 * 4. Update Input component:
 *    <Input
 *      type="tel"
 *      value={formData.phone}
 *      onChange={handlePhoneChange}
 *      className={getPhoneInputClasses(phoneValidationState)}
 *    />
 * 
 * 5. Add duplicate dialog:
 *    <DuplicatePhoneDialog
 *      open={showDuplicateDialog}
 *      onOpenChange={setShowDuplicateDialog}
 *      duplicateData={duplicateData}
 *      onContinue={handleDuplicateConfirm}
 *      onCancel={handleDuplicateCancel}
 *    />
 */
