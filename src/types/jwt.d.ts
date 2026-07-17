import { SafeUser } from '../helpers/user';

declare module '@fastify/jwt' {
  interface FastifyJWT {
    user: {
      user: SafeUser;
      type: 'access';
      iat: number;
      exp: number;
    };
  }
}
