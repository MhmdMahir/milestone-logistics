import 'bootstrap/dist/css/bootstrap.min.css'
import Header from './Header'


function MainPage() {

    return (
        <div className="bg-dark-cover d-flex w-100 h-100 text-center">
            <div className="cover-container d-flex w-100 h-100 p-3 mx-auto flex-column">
                <Header />

                <main role="main" className="inner cover">
                    <h1 className="cover-heading">Cover your page.</h1>
                    <p className="lead">Cover is a one-page template for building simple and beautiful home pages. Download, edit the text, and add your own fullscreen background photo to make it your own.</p>
                    <p className="lead">
                        <a href="#" className="btn btn-lg btn-secondary">Learn more</a>
                    </p>
                </main>

                <footer className="mastfoot mt-auto">
                    <div className="inner">
                        <p>Cover template for <a href="https://getbootstrap.com/">Bootstrap</a>, by <a href="https://twitter.com/mdo">@mdo</a>.</p>
                    </div>
                </footer>
            </div>
        </div>
    )
}

export default MainPage
