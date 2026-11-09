import { Module } from '@nestjs/common';
import { MediaModule } from '@/media/media.module';
import { ReviewAggregateService } from './review-aggregate.service';
import { ReviewRepository } from './review.repository';
import { ReviewService } from './review.service';
import { ReviewMediaService } from './review-media.service';
import { ReviewController } from './controllers/review.controller';
import { ReviewProductController } from './controllers/review-product.controller';
import { ReviewAdminController } from './controllers/review.admin.controller';

@Module({
  imports: [MediaModule],
  controllers: [ReviewProductController, ReviewController, ReviewAdminController],
  providers: [ReviewRepository, ReviewAggregateService, ReviewService, ReviewMediaService],
  exports: [ReviewService, ReviewMediaService],
})
export class ReviewModule {}
