export type MaintenanceType = "Preventivo" | "Correctivo" | "Predictivo" | "Inspección";
export type WorkOrderStatus = "Pendiente" | "En progreso" | "Completada" | "Cancelada";
export type EquipmentStatus = "Operativo" | "En mantenimiento" | "Fuera de servicio";

export interface IEquipment {
  _id?: string;
  code: string;
  name: string;
  area: string;
  status: EquipmentStatus;
  brand?: string;
  model?: string;
  serialNumber?: string;
  installDate?: Date;
  createdAt?: Date;
  updatedAt?: Date;
}

export interface IWorkOrder {
  _id?: string;
  orderNumber: string;
  equipment: string | IEquipment;
  type: MaintenanceType;
  status: WorkOrderStatus;
  description: string;
  assignedTo?: string;
  startDate?: Date;
  endDate?: Date;
  createdAt?: Date;
  updatedAt?: Date;
}
