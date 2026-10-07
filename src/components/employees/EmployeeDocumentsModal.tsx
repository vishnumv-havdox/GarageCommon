import React, { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";
import { supabaseAdmin } from "@/integrations/supabase/adminClient";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  FileText,
  Upload,
  Calendar,
  AlertTriangle,
  CheckCircle2,
  Trash2,
  ExternalLink,
  Download,
  Shield,
  Loader2,
  Clock,
  Plus,
  Eye,
  FileCheck,
  AlertCircle,
} from "lucide-react";
import { format, differenceInDays, parseISO } from "date-fns";

export interface EmployeeDocument {
  id: string;
  employee_id: string;
  document_type: string;
  document_name: string;
  file_url: string;
  file_type?: string;
  file_size?: number;
  upload_date: string;
  expiry_date?: string | null;
  notes?: string | null;
  status: string;
  created_at: string;
}

interface EmployeeDocumentsModalProps {
  isOpen: boolean;
  onClose: () => void;
  employee: {
    id: string;
    name: string;
    email?: string;
    position?: { name: string; department?: string };
  } | null;
  onDocumentsUpdated?: () => void;
}

const DOCUMENT_TYPES = [
  { value: "Aadhaar", label: "Aadhaar Card", hasExpiry: false },
  { value: "PAN", label: "PAN Card", hasExpiry: false },
  { value: "Driving Licence", label: "Driving Licence", hasExpiry: true },
  { value: "Passport", label: "Passport", hasExpiry: true },
  { value: "Employee ID", label: "Employee ID Proof", hasExpiry: true },
  { value: "Address Proof", label: "Address Proof (Voter/Utility)", hasExpiry: false },
  { value: "Safety/Compliance", label: "Safety & Compliance Certificate", hasExpiry: true },
  { value: "Contract", label: "Employment Agreement / Offer Letter", hasExpiry: false },
  { value: "Other", label: "Other Official Document", hasExpiry: true },
];

export function EmployeeDocumentsModal({
  isOpen,
  onClose,
  employee,
  onDocumentsUpdated,
}: EmployeeDocumentsModalProps) {
  const { toast } = useToast();
  const { user } = useAuth();
  const [documents, setDocuments] = useState<EmployeeDocument[]>([]);
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [showUploadForm, setShowUploadForm] = useState(false);

  // Form State
  const [documentType, setDocumentType] = useState("Aadhaar");
  const [documentName, setDocumentName] = useState("");
  const [expiryDate, setExpiryDate] = useState("");
  const [notes, setNotes] = useState("");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen && employee?.id) {
      fetchDocuments();
      setShowUploadForm(false);
      resetForm();
    }
  }, [isOpen, employee?.id]);

  const resetForm = () => {
    setDocumentType("Aadhaar");
    setDocumentName("");
    setExpiryDate("");
    setNotes("");
    setSelectedFile(null);
  };

  const fetchDocuments = async () => {
    if (!employee?.id) return;
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("employee_documents")
        .select("*")
        .eq("employee_id", employee.id)
        .order("created_at", { ascending: false });

      if (error) throw error;
      setDocuments(data || []);
    } catch (err: any) {
      console.error("Error fetching employee documents:", err);
      toast({
        title: "Error loading documents",
        description: err.message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleDocumentTypeChange = (type: string) => {
    setDocumentType(type);
    if (!documentName || DOCUMENT_TYPES.some((d) => d.label === documentName || d.value === documentName)) {
      const matched = DOCUMENT_TYPES.find((d) => d.value === type);
      setDocumentName(matched ? `${matched.label} - ${employee?.name || "Employee"}` : type);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      setSelectedFile(file);
      if (!documentName) {
        const typeLabel = DOCUMENT_TYPES.find((d) => d.value === documentType)?.label || documentType;
        setDocumentName(`${typeLabel} - ${employee?.name || "Employee"}`);
      }
    }
  };

  const getDocumentStatus = (expiry?: string | null): { status: string; label: string; color: string } => {
    if (!expiry) {
      return { status: "Active", label: "Active", color: "bg-emerald-500/10 text-emerald-600 border-emerald-300 dark:border-emerald-800" };
    }
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const expDate = parseISO(expiry);
    const days = differenceInDays(expDate, today);

    if (days < 0) {
      return { status: "Expired", label: `Expired ${Math.abs(days)}d ago`, color: "bg-rose-500/10 text-rose-600 border-rose-300 dark:border-rose-800" };
    }
    if (days <= 30) {
      return { status: "Expiring Soon", label: `Expires in ${days}d`, color: "bg-amber-500/10 text-amber-600 border-amber-300 dark:border-amber-800" };
    }
    return { status: "Active", label: `Valid (${format(expDate, "dd MMM yyyy")})`, color: "bg-emerald-500/10 text-emerald-600 border-emerald-300 dark:border-emerald-800" };
  };

  const handleUpload = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!employee?.id) return;
    if (!selectedFile) {
      toast({
        title: "File Required",
        description: "Please select a document file to upload.",
        variant: "destructive",
      });
      return;
    }

    setUploading(true);
    try {
      const fileExt = selectedFile.name.split(".").pop();
      const sanitizedName = selectedFile.name.replace(/[^a-zA-Z0-9.-]/g, "_");
      const storagePath = `${employee.id}/${Date.now()}_${sanitizedName}`;

      // Upload file to Supabase storage
      const { error: uploadError } = await supabase.storage
        .from("employee-documents")
        .upload(storagePath, selectedFile, {
          cacheControl: "3600",
          upsert: false,
        });

      if (uploadError) throw uploadError;

      // Get public URL
      const { data: urlData } = supabase.storage
        .from("employee-documents")
        .getPublicUrl(storagePath);

      const fileUrl = urlData.publicUrl;

      // Calculate initial status
      const { status } = getDocumentStatus(expiryDate || null);

      // Save document record in table
      const { error: dbError } = await supabase.from("employee_documents").insert({
        employee_id: employee.id,
        document_type: documentType,
        document_name: documentName.trim() || `${documentType} - ${employee.name}`,
        file_url: fileUrl,
        file_type: selectedFile.type || fileExt,
        file_size: selectedFile.size,
        upload_date: new Date().toISOString(),
        expiry_date: expiryDate ? expiryDate : null,
        notes: notes.trim() || null,
        status,
      });

      if (dbError) throw dbError;

      toast({
        title: "Document Uploaded",
        description: `${documentName || documentType} was securely stored.`,
      });

      resetForm();
      setShowUploadForm(false);
      await fetchDocuments();
      onDocumentsUpdated?.();
    } catch (err: any) {
      console.error("Error uploading document:", err);
      toast({
        title: "Upload Failed",
        description: err.message || "Failed to upload document",
        variant: "destructive",
      });
    } finally {
      setUploading(false);
    }
  };

  const handleDelete = async (doc: EmployeeDocument) => {
    if (!confirm(`Are you sure you want to delete "${doc.document_name}"?`)) return;

    setDeletingId(doc.id);
    try {
      // Extract storage path from url if possible
      try {
        const urlParts = doc.file_url.split("/employee-documents/");
        if (urlParts.length > 1) {
          const path = decodeURIComponent(urlParts[1]);
          await supabase.storage.from("employee-documents").remove([path]);
        }
      } catch (storageErr) {
        console.warn("Storage deletion warning:", storageErr);
      }

      const { error } = await supabase
        .from("employee_documents")
        .delete()
        .eq("id", doc.id);

      if (error) throw error;

      toast({
        title: "Document Deleted",
        description: "The document has been removed.",
      });

      setDocuments((prev) => prev.filter((d) => d.id !== doc.id));
      onDocumentsUpdated?.();
    } catch (err: any) {
      console.error("Error deleting document:", err);
      toast({
        title: "Delete Failed",
        description: err.message,
        variant: "destructive",
      });
    } finally {
      setDeletingId(null);
    }
  };

  // Metrics
  const metrics = React.useMemo(() => {
    let expired = 0;
    let expiringSoon = 0;
    let active = 0;

    documents.forEach((d) => {
      const { status } = getDocumentStatus(d.expiry_date);
      if (status === "Expired") expired++;
      else if (status === "Expiring Soon") expiringSoon++;
      else active++;
    });

    return { total: documents.length, active, expiringSoon, expired };
  }, [documents]);

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-3xl max-h-[90vh] flex flex-col p-0 gap-0 overflow-hidden rounded-2xl shadow-2xl">
        <DialogHeader className="p-5 border-b bg-muted/30 shrink-0">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-xl bg-primary/10 text-primary">
                <Shield className="h-5 w-5" />
              </div>
              <div>
                <DialogTitle className="text-xl font-bold flex items-center gap-2">
                  <span>{employee?.name}'s Documents</span>
                  <Badge variant="outline" className="text-xs font-normal">
                    {employee?.position?.name || "Staff"}
                  </Badge>
                </DialogTitle>
                <DialogDescription className="text-xs text-muted-foreground mt-0.5">
                  Secure identity records, compliance certificates, and expiry tracking
                </DialogDescription>
              </div>
            </div>

            <Button
              size="sm"
              onClick={() => setShowUploadForm(!showUploadForm)}
              className="gap-1.5 h-8 text-xs font-medium"
            >
              <Plus className="h-3.5 w-3.5" />
              {showUploadForm ? "Close Form" : "Upload Document"}
            </Button>
          </div>

          {/* Quick Metrics */}
          <div className="grid grid-cols-4 gap-2 pt-3 mt-3 border-t border-border/40">
            <div className="p-2 rounded-lg bg-card border text-center">
              <span className="text-[10px] text-muted-foreground uppercase font-semibold">Total</span>
              <p className="text-lg font-bold">{metrics.total}</p>
            </div>
            <div className="p-2 rounded-lg bg-card border text-center">
              <span className="text-[10px] text-emerald-600 uppercase font-semibold">Active</span>
              <p className="text-lg font-bold text-emerald-600">{metrics.active}</p>
            </div>
            <div className="p-2 rounded-lg bg-card border text-center">
              <span className="text-[10px] text-amber-600 uppercase font-semibold">Expiring Soon</span>
              <p className="text-lg font-bold text-amber-600">{metrics.expiringSoon}</p>
            </div>
            <div className="p-2 rounded-lg bg-card border text-center">
              <span className="text-[10px] text-rose-600 uppercase font-semibold">Expired</span>
              <p className="text-lg font-bold text-rose-600">{metrics.expired}</p>
            </div>
          </div>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto p-5 space-y-4">
          {/* Upload Form Accordion */}
          {showUploadForm && (
            <form
              onSubmit={handleUpload}
              className="p-4 rounded-xl border border-primary/20 bg-primary/5 space-y-4 animate-in fade-in-50 duration-200"
            >
              <div className="flex items-center justify-between pb-2 border-b border-primary/10">
                <h4 className="font-semibold text-sm flex items-center gap-2 text-foreground">
                  <Upload className="h-4 w-4 text-primary" />
                  Upload New Employee Document
                </h4>
                <span className="text-[11px] text-muted-foreground">Supported: PDF, JPG, PNG, WEBP</span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label className="text-xs">Document Type *</Label>
                  <Select value={documentType} onValueChange={handleDocumentTypeChange}>
                    <SelectTrigger className="h-9 text-xs bg-background">
                      <SelectValue placeholder="Select type" />
                    </SelectTrigger>
                    <SelectContent>
                      {DOCUMENT_TYPES.map((d) => (
                        <SelectItem key={d.value} value={d.value} className="text-xs">
                          {d.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-1.5">
                  <Label className="text-xs">Document Title / Display Name *</Label>
                  <Input
                    className="h-9 text-xs bg-background"
                    placeholder="e.g. Aadhaar Card - Front & Back"
                    value={documentName}
                    onChange={(e) => setDocumentName(e.target.value)}
                    required
                  />
                </div>

                <div className="space-y-1.5">
                  <Label className="text-xs flex items-center justify-between">
                    <span>Expiry Date (if applicable)</span>
                    <span className="text-[10px] text-muted-foreground">e.g. Driving Licence</span>
                  </Label>
                  <Input
                    type="date"
                    className="h-9 text-xs bg-background"
                    value={expiryDate}
                    onChange={(e) => setExpiryDate(e.target.value)}
                  />
                </div>

                <div className="space-y-1.5">
                  <Label className="text-xs">Attach Document File *</Label>
                  <Input
                    type="file"
                    accept=".pdf,.png,.jpg,.jpeg,.webp"
                    className="h-9 text-xs bg-background cursor-pointer file:text-xs file:py-1 file:px-2 file:rounded-md file:bg-primary/10 file:text-primary file:border-0"
                    onChange={handleFileChange}
                    required
                  />
                </div>

                <div className="sm:col-span-2 space-y-1.5">
                  <Label className="text-xs">Notes / Document Details (Optional)</Label>
                  <Textarea
                    rows={2}
                    className="text-xs bg-background resize-none"
                    placeholder="Enter ID numbers, issue authority, or verification notes..."
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                  />
                </div>
              </div>

              <div className="flex items-center justify-between pt-2 border-t border-primary/10">
                <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
                  <Shield className="h-3.5 w-3.5 text-emerald-600" />
                  <span>Encrypted & Restricted Access</span>
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="h-8 text-xs"
                    onClick={() => setShowUploadForm(false)}
                    disabled={uploading}
                  >
                    Cancel
                  </Button>
                  <Button
                    type="submit"
                    size="sm"
                    className="h-8 text-xs font-semibold gap-1.5"
                    disabled={uploading || !selectedFile}
                  >
                    {uploading ? (
                      <>
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        Uploading...
                      </>
                    ) : (
                      <>
                        <Upload className="h-3.5 w-3.5" />
                        Upload & Store
                      </>
                    )}
                  </Button>
                </div>
              </div>
            </form>
          )}

          {/* Document List */}
          {loading ? (
            <div className="py-16 text-center">
              <Loader2 className="h-8 w-8 animate-spin mx-auto text-primary" />
              <p className="text-xs text-muted-foreground mt-2">Loading documents...</p>
            </div>
          ) : documents.length === 0 ? (
            <div className="py-14 text-center border-2 border-dashed rounded-xl bg-muted/10">
              <div className="h-12 w-12 rounded-full bg-primary/10 text-primary flex items-center justify-center mx-auto mb-3">
                <FileText className="h-6 w-6" />
              </div>
              <p className="text-sm font-semibold">No Documents Uploaded Yet</p>
              <p className="text-xs text-muted-foreground max-w-sm mx-auto mt-1">
                Upload Aadhaar, PAN, Driving Licence, or compliance documents to track expiry and maintain records.
              </p>
              <Button
                size="sm"
                variant="outline"
                className="mt-4 gap-1.5 text-xs"
                onClick={() => setShowUploadForm(true)}
              >
                <Upload className="h-3.5 w-3.5" />
                Upload First Document
              </Button>
            </div>
          ) : (
            <div className="space-y-3">
              {documents.map((doc) => {
                const statusInfo = getDocumentStatus(doc.expiry_date);
                const isPdf = doc.file_url.toLowerCase().endsWith(".pdf") || doc.file_type?.includes("pdf");

                return (
                  <div
                    key={doc.id}
                    className="p-4 rounded-xl border bg-card hover:shadow-md transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-4 group"
                  >
                    <div className="flex items-start gap-3 min-w-0">
                      <div className="p-2.5 rounded-xl bg-muted shrink-0 text-primary mt-0.5 group-hover:bg-primary/10 transition-colors">
                        {isPdf ? <FileCheck className="h-5 w-5" /> : <FileText className="h-5 w-5" />}
                      </div>
                      <div className="space-y-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <h5 className="font-semibold text-sm text-foreground truncate max-w-[280px] sm:max-w-[340px]">
                            {doc.document_name}
                          </h5>
                          <Badge variant="secondary" className="text-[10px] font-medium px-2 py-0">
                            {doc.document_type}
                          </Badge>
                          <Badge className={`text-[10px] font-medium border px-2 py-0 ${statusInfo.color}`}>
                            {statusInfo.label}
                          </Badge>
                        </div>

                        <div className="flex items-center gap-3 text-[11px] text-muted-foreground flex-wrap">
                          <span>
                            Uploaded: {format(new Date(doc.upload_date), "dd MMM yyyy")}
                          </span>
                          {doc.expiry_date && (
                            <span className="flex items-center gap-1 font-medium">
                              <Calendar className="h-3 w-3 text-muted-foreground" />
                              Expires: {format(new Date(doc.expiry_date), "dd MMM yyyy")}
                            </span>
                          )}
                          {doc.file_size && (
                            <span>{(doc.file_size / (1024 * 1024)).toFixed(2)} MB</span>
                          )}
                        </div>

                        {doc.notes && (
                          <p className="text-xs text-muted-foreground/90 italic bg-muted/40 px-2 py-1 rounded-md mt-1 border border-border/40">
                            {doc.notes}
                          </p>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center gap-2 shrink-0 self-end sm:self-center">
                      <a
                        href={doc.file_url}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center justify-center h-8 px-2.5 rounded-lg text-xs font-medium bg-muted hover:bg-muted/80 text-foreground transition-colors gap-1.5"
                      >
                        <Eye className="h-3.5 w-3.5" />
                        Preview
                      </a>
                      <a
                        href={doc.file_url}
                        download={doc.document_name}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center justify-center h-8 w-8 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
                        title="Download Document"
                      >
                        <Download className="h-3.5 w-3.5" />
                      </a>
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-8 w-8 text-rose-500 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40"
                        disabled={deletingId === doc.id}
                        onClick={() => handleDelete(doc)}
                        title="Delete Document"
                      >
                        {deletingId === doc.id ? (
                          <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        ) : (
                          <Trash2 className="h-3.5 w-3.5" />
                        )}
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        <div className="p-3 border-t bg-muted/20 flex items-center justify-between text-xs text-muted-foreground">
          <div className="flex items-center gap-1.5">
            <Shield className="h-3.5 w-3.5 text-primary" />
            <span>Files are securely retained with encrypted storage paths.</span>
          </div>
          <Button variant="outline" size="sm" onClick={onClose} className="h-7 text-xs">
            Done
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
