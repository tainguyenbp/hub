import { fireEvent, render, waitFor } from '@testing-library/react';
import React from 'react';
import { BrowserRouter as Router } from 'react-router-dom';
import { mocked } from 'ts-jest/utils';

import { API } from '../../api';
import { ErrorKind, Package } from '../../types';
import prepareQuerystring from '../../utils/prepareQueryString';
import PackageView from './index';
jest.mock('../../api');
jest.mock('../../utils/updateMetaIndex');

const getMockPackage = (fixtureId: string): Package => {
  return require(`./__fixtures__/index/${fixtureId}.json`) as Package;
};

const mockIsLoading = jest.fn();
const mockHistoryPush = jest.fn();
const mockHistoryReplace = jest.fn();

jest.mock('react-router-dom', () => ({
  ...(jest.requireActual('react-router-dom') as {}),
  useHistory: () => ({
    push: mockHistoryPush,
    replace: mockHistoryReplace,
    action: 'POP',
  }),
}));

const defaultProps = {
  isLoadingPackage: false,
  setIsLoadingPackage: mockIsLoading,
  repositoryKind: 'helm',
  repositoryName: 'repoName',
  packageName: 'packageName',
  searchUrlReferer: undefined,
};

describe('Package index', () => {
  afterEach(() => {
    jest.resetAllMocks();
  });

  it('creates snapshot', async () => {
    const mockPackage = getMockPackage('1');
    mocked(API).getPackage.mockResolvedValue(mockPackage);

    const result = render(
      <Router>
        <PackageView {...defaultProps} />
      </Router>
    );

    await waitFor(() => {
      expect(result.asFragment()).toMatchSnapshot();
    });
  });

  describe('Render', () => {
    it('renders component', async () => {
      const mockPackage = getMockPackage('2');
      mocked(API).getPackage.mockResolvedValue(mockPackage);

      render(
        <Router>
          <PackageView {...defaultProps} />
        </Router>
      );

      await waitFor(() => {
        expect(API.getPackage).toHaveBeenCalledTimes(1);
      });
    });

    it('displays loading spinner', async () => {
      const mockPackage = getMockPackage('3');
      mocked(API).getPackage.mockResolvedValue(mockPackage);

      const props = {
        ...defaultProps,
        isLoadingPackage: true,
      };

      const { getByRole } = render(
        <Router>
          <PackageView {...props} />
        </Router>
      );

      const spinner = await waitFor(() => getByRole('status'));

      expect(spinner).toBeTruthy();
      await waitFor(() => {});
    });
  });

  describe('when getPackage fails', () => {
    it('generic error', async () => {
      mocked(API).getPackage.mockRejectedValue({
        kind: ErrorKind.Other,
      });

      const props = {
        ...defaultProps,
      };

      const { getByTestId } = render(
        <Router>
          <PackageView {...props} />
        </Router>
      );

      await waitFor(() => {
        expect(API.getPackage).toHaveBeenCalledTimes(1);
      });

      const noData = getByTestId('noData');
      expect(noData).toBeInTheDocument();
      expect(noData).toHaveTextContent(/An error occurred getting this package, please try again later./i);
    });

    it('not found package', async () => {
      mocked(API).getPackage.mockRejectedValue({
        kind: ErrorKind.NotFound,
      });

      const props = {
        ...defaultProps,
      };

      const { getByTestId, getByText } = render(
        <Router>
          <PackageView {...props} />
        </Router>
      );

      await waitFor(() => {
        expect(API.getPackage).toHaveBeenCalledTimes(1);
      });

      const noData = getByTestId('noData');
      expect(noData).toBeInTheDocument();
      expect(noData).toHaveTextContent('Sorry, the package you requested was not found.');
      expect(
        getByText(
          'The package you are looking for may have been deleted by the provider, or it may now belong to a different repository. Please try searching for it, as it may help locating the package in a different repository or discovering other alternatives.'
        )
      ).toBeInTheDocument();
    });
  });

  describe('Go back button', () => {
    it('creates snapshot', async () => {
      const searchUrlReferer = {
        tsQueryWeb: 'test',
        filters: {},
        pageNumber: 1,
        deprecated: false,
      };
      const mockPackage = getMockPackage('4');
      mocked(API).getPackage.mockResolvedValue(mockPackage);

      const { getByTestId } = render(
        <Router>
          <PackageView {...defaultProps} searchUrlReferer={searchUrlReferer} />
        </Router>
      );

      const goBack = await waitFor(() => getByTestId('goBack'));

      expect(goBack).toBeInTheDocument();
      fireEvent.click(goBack);
      expect(mockHistoryPush).toHaveBeenCalledTimes(1);
      expect(mockHistoryPush).toHaveBeenCalledWith({
        pathname: '/packages/search',
        search: prepareQuerystring(searchUrlReferer),
        state: { fromDetail: true },
      });

      await waitFor(() => {});
    });
  });

  describe('Repository button', () => {
    it('renders repository link', async () => {
      const mockPackage = getMockPackage('5');
      mocked(API).getPackage.mockResolvedValue(mockPackage);

      const { getByTestId } = render(
        <Router>
          <PackageView {...defaultProps} />
        </Router>
      );

      const link = await waitFor(() => getByTestId('repoLink'));
      expect(link).toBeInTheDocument();
      fireEvent.click(link);
      expect(mockHistoryPush).toHaveBeenCalledTimes(1);
      expect(mockHistoryPush).toHaveBeenCalledWith({
        pathname: '/packages/search',
        search: prepareQuerystring({
          pageNumber: 1,
          filters: {
            repo: [mockPackage.repository.name],
          },
          deprecated: mockPackage.deprecated,
        }),
      });

      await waitFor(() => {});
    });
  });

  describe('Modal', () => {
    it('renders properly', async () => {
      const mockPackage = getMockPackage('6');
      mocked(API).getPackage.mockResolvedValue(mockPackage);

      const { getByRole } = render(
        <Router>
          <PackageView {...defaultProps} />
        </Router>
      );

      const dialog = await waitFor(() => getByRole('dialog'));
      expect(dialog).toBeInTheDocument();

      await waitFor(() => {});
    });
  });

  describe('Readme', () => {
    it('does not render it when readme is null and displays no data message', async () => {
      const mockPackage = getMockPackage('7');
      mocked(API).getPackage.mockResolvedValue(mockPackage);

      const { getByTestId, queryByTestId } = render(
        <Router>
          <PackageView {...defaultProps} />
        </Router>
      );

      await waitFor(() => getByTestId('mainPackage'));

      const noData = getByTestId('noData');
      expect(noData).toBeInTheDocument();
      expect(noData).toHaveTextContent('No README file available for this package');
      expect(queryByTestId('readme')).toBeNull();

      await waitFor(() => {});
    });

    it('renders it correctly', async () => {
      const mockPackage = getMockPackage('8');
      mocked(API).getPackage.mockResolvedValue(mockPackage);

      const { getByTestId, queryByTestId } = render(
        <Router>
          <PackageView {...defaultProps} />
        </Router>
      );

      await waitFor(() => getByTestId('mainPackage'));

      const readme = queryByTestId('readme');
      expect(readme).toBeInTheDocument();
      expect(readme).toHaveTextContent(mockPackage.readme!);

      await waitFor(() => {});
    });
  });

  describe('Labels', () => {
    it('renders Verified Publisher label', async () => {
      const mockPackage = getMockPackage('9');
      mocked(API).getPackage.mockResolvedValue(mockPackage);

      const { getByTestId, getAllByText } = render(
        <Router>
          <PackageView {...defaultProps} />
        </Router>
      );

      await waitFor(() => getByTestId('mainPackage'));

      expect(getAllByText('Verified Publisher')).toHaveLength(2);

      await waitFor(() => {});
    });
  });

  describe('Helm package', () => {
    it('renders CRDs when are defined', async () => {
      const mockPackage = getMockPackage('10');
      mocked(API).getPackage.mockResolvedValue(mockPackage);

      const { getByText, getByTestId } = render(
        <Router>
          <PackageView {...defaultProps} />
        </Router>
      );

      await waitFor(() => getByTestId('mainPackage'));

      expect(getByText('Custom Resource Definitions')).toBeInTheDocument();
      expect(getByTestId('resourceDefinition')).toBeInTheDocument();
      await waitFor(() => {});
    });
  });

  describe('OLM package', () => {
    it('renders CRDs from crds prop when is defined', async () => {
      const mockPackage = getMockPackage('11');
      mocked(API).getPackage.mockResolvedValue(mockPackage);

      const { getByText, getByTestId, getAllByTestId } = render(
        <Router>
          <PackageView {...defaultProps} />
        </Router>
      );

      await waitFor(() => getByTestId('mainPackage'));

      expect(getByText('Custom Resource Definitions')).toBeInTheDocument();
      expect(getAllByTestId('resourceDefinition')).toHaveLength(1);
      await waitFor(() => {});
    });
  });

  describe('Falco rules', () => {
    it('renders rules properly', async () => {
      const mockPackage = getMockPackage('12');
      mocked(API).getPackage.mockResolvedValue(mockPackage);

      const { getByTestId, getByText } = render(
        <Router>
          <PackageView {...defaultProps} />
        </Router>
      );

      await waitFor(() => getByTestId('mainPackage'));

      waitFor(() => {
        expect(getByText('Rules')).toBeInTheDocument();

        expect(getByTestId('ctcBtn')).toBeInTheDocument();
        expect(getByTestId('downloadBtn')).toBeInTheDocument();
      });

      await waitFor(() => {});
    });
  });
});
