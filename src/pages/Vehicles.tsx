import { useState } from "react";
import { Car, Plus, Search, Filter, Eye, Edit, Trash2, Phone, Mail, Calendar } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from "@/components/ui/table";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import ServiceStatusTracker from "@/components/ServiceStatusTracker";

// Mock data
const vehicles = [
  {
    id: 1,
    regNumber: "KA-01-AB-1234",
    model: "Honda City",
    year: "2020",
    customer: {
      name: "Rajesh Kumar",
      phone: "+91 98765 43210",
      email: "rajesh@example.com"
    },
    status: "in-service",
    serviceType: "Full Service",
    assignedTo: "John Smith",
    entryDate: "2024-01-15",
    estimatedCompletion: "2024-01-16"
  },
  {
    id: 2,
    regNumber: "KA-02-CD-5678",
    model: "Maruti Swift",
    year: "2019",
    customer: {
      name: "Priya Sharma",
      phone: "+91 87654 32109",
      email: "priya@example.com"
    },
    status: "ready",
    serviceType: "Painting",
    assignedTo: "Sarah Davis",
    entryDate: "2024-01-14",
    estimatedCompletion: "2024-01-15"
  },
  {
    id: 3,
    regNumber: "KA-03-EF-9012",
    model: "Hyundai Creta",
    year: "2021",
    customer: {
      name: "Amit Patel",
      phone: "+91 76543 21098",
      email: "amit@example.com"
    },
    status: "pending",
    serviceType: "Engine Repair",
    assignedTo: "Mike Johnson",
    entryDate: "2024-01-16",
    estimatedCompletion: "2024-01-18"
  },
];

const statusColors = {
  "pending": "bg-status-pending",
  "in-service": "bg-status-progress",
  "ready": "bg-status-ready",
  "delivered": "bg-status-completed"
};

export default function Vehicles() {
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedVehicle, setSelectedVehicle] = useState<typeof vehicles[0] | null>(null);

  const filteredVehicles = vehicles.filter(vehicle =>
    vehicle.regNumber.toLowerCase().includes(searchTerm.toLowerCase()) ||
    vehicle.customer.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    vehicle.model.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="p-6 space-y-8 bg-background min-h-screen">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Vehicle Management</h1>
          <p className="text-muted-foreground">
            Manage all vehicles and track their service progress
          </p>
        </div>
        <Button className="bg-gradient-primary text-primary-foreground hover:shadow-glow">
          <Plus className="h-4 w-4 mr-2" />
          Add Vehicle
        </Button>
      </div>

      {/* Search and Filters */}
      <Card className="bg-gradient-card border-border shadow-card">
        <CardContent className="p-6">
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
              <Input
                placeholder="Search by registration, customer name, or model..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>
            <Button variant="outline">
              <Filter className="h-4 w-4 mr-2" />
              Filters
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Vehicles Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Vehicles List */}
        <div className="space-y-4">
          <h2 className="text-xl font-semibold text-foreground">All Vehicles</h2>
          
          {filteredVehicles.map((vehicle) => (
            <Card 
              key={vehicle.id} 
              className={`bg-gradient-card border-border shadow-card hover:shadow-elegant transition-all duration-300 cursor-pointer ${
                selectedVehicle?.id === vehicle.id ? "ring-2 ring-primary" : ""
              }`}
              onClick={() => setSelectedVehicle(vehicle)}
            >
              <CardContent className="p-6">
                <div className="flex items-start justify-between mb-4">
                  <div>
                    <h3 className="text-lg font-semibold text-foreground">{vehicle.regNumber}</h3>
                    <p className="text-sm text-muted-foreground">{vehicle.model} ({vehicle.year})</p>
                  </div>
                  <Badge className={`${statusColors[vehicle.status]} text-white`}>
                    {vehicle.status.replace("-", " ").toUpperCase()}
                  </Badge>
                </div>

                <div className="space-y-3">
                  <div className="flex items-center space-x-3">
                    <Avatar className="h-8 w-8">
                      <AvatarFallback className="bg-primary text-primary-foreground text-xs">
                        {vehicle.customer.name.split(" ").map(n => n[0]).join("")}
                      </AvatarFallback>
                    </Avatar>
                    <div>
                      <p className="text-sm font-medium text-foreground">{vehicle.customer.name}</p>
                      <div className="flex items-center space-x-4 text-xs text-muted-foreground">
                        <span className="flex items-center">
                          <Phone className="h-3 w-3 mr-1" />
                          {vehicle.customer.phone}
                        </span>
                        <span className="flex items-center">
                          <Mail className="h-3 w-3 mr-1" />
                          {vehicle.customer.email}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <p className="text-muted-foreground">Service Type</p>
                      <p className="font-medium text-foreground">{vehicle.serviceType}</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">Assigned To</p>
                      <p className="font-medium text-foreground">{vehicle.assignedTo}</p>
                    </div>
                  </div>

                  <div className="flex items-center justify-between pt-2 border-t border-border">
                    <div className="flex items-center text-xs text-muted-foreground">
                      <Calendar className="h-3 w-3 mr-1" />
                      Entry: {vehicle.entryDate}
                    </div>
                    <div className="flex space-x-2">
                      <Button size="sm" variant="ghost">
                        <Eye className="h-3 w-3" />
                      </Button>
                      <Button size="sm" variant="ghost">
                        <Edit className="h-3 w-3" />
                      </Button>
                      <Button size="sm" variant="ghost">
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Vehicle Details */}
        <div className="space-y-4">
          <h2 className="text-xl font-semibold text-foreground">Service Details</h2>
          
          {selectedVehicle ? (
            <div className="space-y-6">
              {/* Customer Info Card */}
              <Card className="bg-gradient-card border-border shadow-card">
                <CardHeader>
                  <CardTitle className="flex items-center space-x-2">
                    <Car className="h-5 w-5 text-primary" />
                    <span>Vehicle & Customer Info</span>
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <p className="text-sm text-muted-foreground">Registration</p>
                      <p className="font-semibold text-foreground">{selectedVehicle.regNumber}</p>
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Model</p>
                      <p className="font-semibold text-foreground">{selectedVehicle.model} ({selectedVehicle.year})</p>
                    </div>
                  </div>
                  
                  <div className="space-y-2">
                    <p className="text-sm text-muted-foreground">Customer</p>
                    <div className="flex items-center space-x-3">
                      <Avatar>
                        <AvatarFallback className="bg-primary text-primary-foreground">
                          {selectedVehicle.customer.name.split(" ").map(n => n[0]).join("")}
                        </AvatarFallback>
                      </Avatar>
                      <div>
                        <p className="font-medium text-foreground">{selectedVehicle.customer.name}</p>
                        <p className="text-sm text-muted-foreground">{selectedVehicle.customer.phone}</p>
                        <p className="text-sm text-muted-foreground">{selectedVehicle.customer.email}</p>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Service Status */}
              <ServiceStatusTracker
                vehicleNumber={selectedVehicle.regNumber}
                customerName={selectedVehicle.customer.name}
                steps={[
                  { branch: "mechanical", name: "Mechanical Works", status: "completed", assignedTo: "John Smith", completedAt: "2024-01-15 10:30" },
                  { branch: "tinker", name: "Tinker Works", status: "completed", assignedTo: "Mike Johnson", completedAt: "2024-01-15 14:45" },
                  { branch: "painting", name: "Painting Works", status: "in-progress", assignedTo: "Sarah Davis", estimatedTime: "2 hours" },
                  { branch: "electrical", name: "Electrical Works", status: "pending", estimatedTime: "1 hour" },
                  { branch: "final-check", name: "Final Check", status: "pending", estimatedTime: "30 mins" }
                ]}
                overallStatus={selectedVehicle.status === "ready" ? "ready" : "in-progress"}
              />
            </div>
          ) : (
            <Card className="bg-gradient-card border-border shadow-card">
              <CardContent className="p-12 text-center">
                <Car className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                <p className="text-muted-foreground">Select a vehicle to view details</p>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}