import mongoose, { Document, Schema, Types } from 'mongoose';

export type ProjectStatus = 'planned' | 'active' | 'completed' | 'cancelled';

export interface IProject extends Document {
  projectId: string;
  name: string;
  description?: string;
  startDate?: Date;
  deadline?: Date;
  status: ProjectStatus;
  teamMembers: Types.ObjectId[];
  createdAt: Date;
  updatedAt: Date;
}

const ProjectSchema = new Schema<IProject>(
  {
    projectId: {
      type: String,
      required: [true, 'Project ID is required'],
      unique: true,
      trim: true,
      index: true,
    },
    name: {
      type: String,
      required: [true, 'Project name is required'],
      trim: true,
      minlength: [2, 'Project name must be at least 2 characters'],
      maxlength: [150, 'Project name cannot exceed 150 characters'],
    },
    description: {
      type: String,
      trim: true,
      default: '',
    },
    startDate: {
      type: Date,
    },
    deadline: {
      type: Date,
    },
    status: {
      type: String,
      required: [true, 'Project status is required'],
      enum: {
        values: ['planned', 'active', 'completed', 'cancelled'],
        message: '{VALUE} is not a valid project status. Allowed: planned, active, completed, cancelled',
      },
      default: 'planned',
      index: true,
    },
    teamMembers: [
      {
        type: Schema.Types.ObjectId,
        ref: 'User',
      },
    ],
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

// Indexes
ProjectSchema.index({ status: 1, createdAt: -1 });

export const Project = (mongoose.models.Project as mongoose.Model<IProject>) || mongoose.model<IProject>('Project', ProjectSchema);

export default Project;
