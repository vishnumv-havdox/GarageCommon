/**
 * Service Type Configuration
 * Maps service types to required inventory categories, fields, and smart suggestions
 */

export type ServiceType =
  | 'Mechanical Repair'
  | 'Body Building'
  | 'Painting'
  | 'Electrical Work'
  | 'Tinker Work'
  | 'Engine Overhaul'
  | 'Transmission Repair'
  | 'Brake System'
  | 'Suspension Work'
  | 'Air Conditioning'
  | 'Custom Modification';

export type Department =
  | 'Service'
  | 'Sales'
  | 'Administration'
  | 'Parts'
  | 'Finance'
  | 'HR';

export interface ServiceTypeConfig {
  name: ServiceType;
  department: Department;
  requiredFields: string[];
  inventoryCategories: string[];
  suggestedParts: string[];
  tasks: string[];
  estimatedDuration: string; // e.g., "2-4 hours", "1-2 days"
  commonIssues: string[];
}

export const serviceTypeConfig: Record<ServiceType, ServiceTypeConfig> = {
  'Mechanical Repair': {
    name: 'Mechanical Repair',
    department: 'Service',
    requiredFields: ['vehicle_id', 'service_type', 'description', 'estimated_cost'],
    inventoryCategories: ['Mechanical Parts', 'Filters', 'Fluids', 'Bearings', 'Seals'],
    suggestedParts: ['Oil Filter', 'Air Filter', 'Engine Oil', 'Brake Pads', 'Spark Plugs'],
    tasks: ['Oil Change', 'Filter Replacement', 'Spark Plug Replacement', 'General Inspection', 'Fluid Top-up'],
    estimatedDuration: '2-4 hours',
    commonIssues: ['Engine noise', 'Gear shifting issues', 'Strange vibrations', 'Overheating']
  },
  'Body Building': {
    name: 'Body Building',
    department: 'Service',
    requiredFields: ['vehicle_id', 'service_type', 'description', 'estimated_cost'],
    inventoryCategories: ['Body Parts', 'Sheet Metal', 'Paint Supplies', 'Welding Consumables'],
    suggestedParts: ['Body Panels', 'Headlights', 'Bumpers', 'Mirrors', 'Paint Materials'],
    tasks: ['Panel Beating', 'Dent Removal', 'Frame Straightening', 'Welding', 'Part Replacement'],
    estimatedDuration: '3-7 days',
    commonIssues: ['Collision damage', 'Rust repair', 'Custom modifications', 'Frame work']
  },
  'Painting': {
    name: 'Painting',
    department: 'Service',
    requiredFields: ['vehicle_id', 'service_type', 'description', 'color_code', 'estimated_cost'],
    inventoryCategories: ['Paint Supplies', 'Clear Coat', 'Primers', 'Sandpaper', 'Masking'],
    suggestedParts: ['Automotive Paint', 'Clear Coat', 'Primer', 'Masking Tape', 'Sandpaper'],
    tasks: ['Full Body Paint', 'Touch-up', 'Polishing', 'Sanding', 'Clear Coat Application'],
    estimatedDuration: '2-5 days',
    commonIssues: ['Faded paint', 'Scratches', 'Rust spots', 'Custom color matching']
  },
  'Electrical Work': {
    name: 'Electrical Work',
    department: 'Service',
    requiredFields: ['vehicle_id', 'service_type', 'description', 'estimated_cost'],
    inventoryCategories: ['Electrical Parts', 'Wiring', 'Fuses', 'Relays', 'Sensors'],
    suggestedParts: ['Fuses', 'Relays', 'Alternator', 'Starter', 'Wiring Harness'],
    tasks: ['Battery Check', 'Wiring Repair', 'Alternator Replacement', 'Fuse Replacement', 'Diagnostic Scan'],
    estimatedDuration: '1-4 hours',
    commonIssues: ['Dead battery', 'Alternator failure', 'Faulty wiring', 'Sensor errors']
  },
  'Tinker Work': {
    name: 'Tinker Work',
    department: 'Service',
    requiredFields: ['vehicle_id', 'service_type', 'description', 'estimated_cost'],
    inventoryCategories: ['Body Parts', 'Mechanical Parts', 'Bolts', 'Nuts', 'Washers'],
    suggestedParts: ['Door Handles', 'Locks', 'Hinges', 'Bolts', 'Weather Stripping'],
    tasks: ['Lock Repair', 'Hinge Adjustment', 'Window Mechanism Repair', 'Handle Replacement'],
    estimatedDuration: '2-6 hours',
    commonIssues: ['Door alignment', 'Panel gaps', 'Trunk issues', 'Hinge replacement']
  },
  'Engine Overhaul': {
    name: 'Engine Overhaul',
    department: 'Service',
    requiredFields: ['vehicle_id', 'service_type', 'description', 'estimated_cost', 'engine_type'],
    inventoryCategories: ['Engine Parts', 'Pistons', 'Rings', 'Bearings', 'Gaskets', 'Seals', 'Fluids'],
    suggestedParts: ['Piston Kit', 'Ring Set', 'Main Bearings', 'Head Gasket', 'Timing Belt'],
    tasks: ['Head Gasket Replacement', 'Piston Ring Replacement', 'Valve Clearance Adjustment', 'Timing Belt Replacement'],
    estimatedDuration: '5-10 days',
    commonIssues: ['Engine knocking', 'Low compression', 'Oil leaks', 'Coolant leaks']
  },
  'Transmission Repair': {
    name: 'Transmission Repair',
    department: 'Service',
    requiredFields: ['vehicle_id', 'service_type', 'description', 'transmission_type', 'estimated_cost'],
    inventoryCategories: ['Transmission Parts', 'Clutch', 'Flywheel', 'Gears', 'Bearings', 'Fluids'],
    suggestedParts: ['Clutch Kit', 'Flywheel', 'Transmission Fluid', 'Gears', 'Synchronizers'],
    tasks: ['Clutch Replacement', 'Fluid Flush', 'Gear Replacement', 'Linkage Adjustment'],
    estimatedDuration: '3-7 days',
    commonIssues: ['Gear slipping', 'Hard shifting', 'Noise when in gear', 'Fluid leaks']
  },
  'Brake System': {
    name: 'Brake System',
    department: 'Service',
    requiredFields: ['vehicle_id', 'service_type', 'description', 'brake_type', 'estimated_cost'],
    inventoryCategories: ['Brake Parts', 'Pads', 'Rotors', 'Calipers', 'Lines', 'Fluid'],
    suggestedParts: ['Brake Pads', 'Brake Rotors', 'Brake Calipers', 'Brake Hoses', 'Brake Fluid'],
    tasks: ['Pad Replacement', 'Rotor Resurfacing/Replacement', 'Bleeding', 'Caliper Service'],
    estimatedDuration: '1-3 hours',
    commonIssues: ['Squeaking brakes', 'Soft pedal', 'Pulling to one side', 'Vibration']
  },
  'Suspension Work': {
    name: 'Suspension Work',
    department: 'Service',
    requiredFields: ['vehicle_id', 'service_type', 'description', 'suspension_type', 'estimated_cost'],
    inventoryCategories: ['Suspension Parts', 'Shocks', 'Springs', 'Bushings', 'Links', 'Ball Joints'],
    suggestedParts: ['Shock Absorbers', 'Coil Springs', 'Control Arms', 'Ball Joints', 'Tie Rods'],
    tasks: ['Shock Replacement', 'Alignment', 'Bushing Replacement', 'Ball Joint Replacement'],
    estimatedDuration: '2-5 hours',
    commonIssues: ['Bumpy ride', 'Uneven tire wear', 'Pulling', 'Noise over bumps']
  },
  'Air Conditioning': {
    name: 'Air Conditioning',
    department: 'Service',
    requiredFields: ['vehicle_id', 'service_type', 'description', 'estimated_cost'],
    inventoryCategories: ['AC Parts', 'Refrigerant', 'Compressor', 'Condenser', 'Evaporator'],
    suggestedParts: ['Refrigerant', 'AC Filter', 'Compressor', 'Condenser', 'Blower Motor'],
    tasks: ['Gas Top-up', 'Leak Test', 'Compressor Service', 'Filter Replacement'],
    estimatedDuration: '1-3 hours',
    commonIssues: ['Not cooling', 'Weak airflow', 'Strange odors', 'Noisy operation']
  },
  'Custom Modification': {
    name: 'Custom Modification',
    department: 'Service',
    requiredFields: ['vehicle_id', 'service_type', 'description', 'modification_type', 'estimated_cost'],
    inventoryCategories: ['Custom Parts', 'Accessories', 'Electrical Parts', 'Body Parts'],
    suggestedParts: ['Custom Wheels', 'LED Lights', 'Sound System', 'Body Kits', 'Interior Accessories'],
    tasks: ['Installation', 'Wiring', 'Fabrication', 'Testing'],
    estimatedDuration: '1-14 days',
    commonIssues: ['Custom requirements', 'Performance upgrades', 'Aesthetic changes', 'Special orders']
  }
};

// Get service types as an array for dropdowns
export const serviceTypes: ServiceType[] = Object.keys(serviceTypeConfig) as ServiceType[];

// Get department-specific service types
export const getServiceTypesByDepartment = (department: Department): ServiceType[] => {
  return Object.values(serviceTypeConfig)
    .filter(config => config.department === department)
    .map(config => config.name);
};

// Get eligible employees for a service type
export const getEligiblePositions = (serviceType: ServiceType): string[] => {
  const config = serviceTypeConfig[serviceType];
  if (!config) return [];

  // Return positions that can perform this type of work
  const positionMap: Record<Department, string[]> = {
    'Service': ['Mechanic', 'Senior Mechanic', 'Technician', 'Master Technician'],
    'Sales': [],
    'Administration': [],
    'Parts': [],
    'Finance': [],
    'HR': []
  };

  return positionMap[config.department];
};

// Get inventory suggestions for a service type
export const getInventorySuggestions = (serviceType: ServiceType): string[] => {
  return serviceTypeConfig[serviceType]?.suggestedParts || [];
};

// Get all inventory categories
export const inventoryCategories = [
  'Mechanical Parts',
  'Body Parts',
  'Electrical Parts',
  'Paint Supplies',
  'Brake Parts',
  'Suspension Parts',
  'Transmission Parts',
  'Engine Parts',
  'AC Parts',
  'Custom Parts',
  'Filters',
  'Fluids',
  'Bearings',
  'Seals',
  'Wiring',
  'Fuses',
  'Relays',
  'Sensors',
  'Bolts',
  'Nuts',
  'Washers',
  'Sheet Metal',
  'Welding Consumables',
  'Clear Coat',
  'Primers',
  'Sandpaper',
  'Masking',
  'Clutch',
  'Flywheel',
  'Gears',
  'Pistons',
  'Rings',
  'Gaskets',
  'Shocks',
  'Springs',
  'Bushings',
  'Links',
  'Ball Joints',
  'Refrigerant',
  'Compressor',
  'Condenser',
  'Evaporator',
  'Accessories',
  'Interior Accessories'
];

