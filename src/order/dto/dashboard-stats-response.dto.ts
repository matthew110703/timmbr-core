import { AdminOrderListItemDto } from './order-response.dto';

export class DashboardStatsCountsDto {
  newOrders!: number;
  processing!: number;
  outForDelivery!: number;
  completed!: number;
}

export class DashboardStatsResponseDto {
  counts!: DashboardStatsCountsDto;
  recentOrders!: AdminOrderListItemDto[];
}
