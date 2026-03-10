import {
  redirect,
  type LoaderFunctionArgs,
  type ServerRuntimeMetaFunction as MetaFunction,
} from '@remix-run/server-runtime';

export const meta: MetaFunction = () => [{ title: 'Corgiban' }];

export function loader(_args: LoaderFunctionArgs) {
  return redirect('/play');
}

export default function Index() {
  return null;
}
