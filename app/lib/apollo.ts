// File: app/lib/apollo.ts
import { ApolloClient, InMemoryCache, HttpLink } from '@apollo/client';

const HTTP_ENDPOINT = 'https://api.studio.thegraph.com/query/107611/mintbay/version/latest';

const httpLink = new HttpLink({
  uri: HTTP_ENDPOINT,
  headers: {
    Authorization: `Bearer 51af42cda5c7dec0847e70fcc1d3d3db`,
  },
});

const client = new ApolloClient({
  link: httpLink,
  cache: new InMemoryCache(),
  defaultOptions: {
    query: { fetchPolicy: 'cache-first', errorPolicy: 'all' },
    watchQuery: { fetchPolicy: 'cache-and-network' },
  },
});

export default client;

export function initializeApollo() {
  return client;
}