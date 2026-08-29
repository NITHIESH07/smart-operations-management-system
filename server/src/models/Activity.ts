import mongoose, { Document, Schema, Types } from 'mongoose';

export interface IActivity extends Document {
  userId: Types.ObjectId;
  action: string;
  entity: string;
  previousValue?: Record<string, unknown> | string | number | boolean | null;
  newValue?: Record<string, unknown> | string | number | boolean | null;
  timestamp: Date;
  createdAt: Date;
  updatedAt: Date;
}

const ActivitySchema = new Schema<IActivity>(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'User reference is required for activity log'],
      index: true,
    },
    action: {
      type: String,
      required: [true, 'Action name is required'],
      trim: true,
      index: true,
    },
    entity: {
      type: String,
      required: [true, 'Entity type is required'],
      trim: true,
      index: true,
    },
    previousValue: {
      type: Schema.Types.Mixed,
      default: null,
    },
    newValue: {
      type: Schema.Types.Mixed,
      default: null,
    },
    timestamp: {
      type: Date,
      default: Date.now,
      index: true,
    },
  },
  {
    timestamps: true,
    toJSON: {
      transform: (_, ret) => {
        delete (ret as Record<string, unknown>).__v;
        return ret;
      },
    },
  }
);

// Compound Index for chronological queries per entity or user
ActivitySchema.index({ entity: 1, timestamp: -1 });
ActivitySchema.index({ userId: 1, timestamp: -1 });

export const Activity = (mongoose.models.Activity as mongoose.Model<IActivity>) || mongoose.model<IActivity>('Activity', ActivitySchema);

export default Activity;
