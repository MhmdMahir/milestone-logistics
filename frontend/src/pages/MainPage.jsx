import Header from '../components/Header';
import CardList from '../components/CardList';
import FixedFooter from '../components/FixedFooter';
import FloatAction from '../components/FloatAction';

function MainPage() {
    return (
        <div className="container pt-5 mt-4 pb-5 text-start">
            <Header />
            <div className="mt-4 mb-4">
                <h1 className="h2 mb-4">Hello, [name] !</h1>
                <CardList />
            </div>
            <FloatAction />
            <FixedFooter />
        </div>
    );
}

export default MainPage;
