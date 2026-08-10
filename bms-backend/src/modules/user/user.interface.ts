
export interface IUser {
  _id?: string | undefined;
  email: string;
  name: string;
  phone?: number;
  role: 'admin' | 'user';
  activateUser? : boolean;
  createdAt: Date;
  updatedAt: Date;
}